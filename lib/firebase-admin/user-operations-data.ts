import "server-only";
import type { AdminRole } from "./authorize";
import { getAdminAuth, getAdminFirestore } from "./server";
import type {
  UserModerationHistoryItem,
  UserOperationsFilters,
  UserOperationsResponse,
  UserOperationsRow,
} from "@/lib/user-operations/types";

type AuthUser = {
  uid: string;
  email?: string;
  displayName?: string;
  emailVerified: boolean;
  disabled: boolean;
  metadata: { lastSignInTime?: string | null };
};

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate(): Date }).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

export function maskEmail(email: string | undefined): string {
  if (!email) return "이메일 없음";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

export function maskUid(uid: string): string {
  if (uid.length <= 8) return `${uid.slice(0, 2)}…${uid.slice(-2)}`;
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`;
}

function maskName(name: string | undefined): string | null {
  if (!name) return null;
  return `${name.slice(0, 1)}${"*".repeat(Math.min(3, Math.max(1, name.length - 1)))}`;
}

function encodePageToken(token: string | undefined): string | null {
  return token ? Buffer.from(token, "utf8").toString("base64url") : null;
}

function decodePageToken(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    return Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    return undefined;
  }
}

async function enrichUser(user: AuthUser, role: AdminRole): Promise<UserOperationsRow> {
  const db = getAdminFirestore();
  const [profile, moderation, history] = await Promise.all([
    db.collection("userProfiles").doc(user.uid).get(),
    db.collection("userModerationStates").doc(user.uid).get(),
    db.collection("auditLogs").where("targetUid", "==", user.uid).orderBy("createdAt", "desc").limit(5).get(),
  ]);
  const profileData = profile.data() ?? {};
  const moderationData = moderation.data() ?? {};
  const trustFlags = (Array.isArray(moderationData.trustFlags)
    ? moderationData.trustFlags.filter((flag: unknown): flag is string => typeof flag === "string")
    : Array.isArray(profileData.trustFlags)
      ? profileData.trustFlags.filter((flag: unknown): flag is string => typeof flag === "string")
      : []).slice(0, 8);
  const rateLimit = toDate(moderationData.talkRateLimitedUntil);
  const review = moderationData.permanentSuspensionReview;
  const lastActivity = toDate(profileData.lastActivityAt) ?? toDate(user.metadata.lastSignInTime);

  const recentModerationHistory: UserModerationHistoryItem[] = history.docs.map((doc) => {
    const data = doc.data();
    const occurredAt = toDate(data.createdAt)?.toISOString() ?? new Date(0).toISOString();
    const base: UserModerationHistoryItem = {
      action: typeof data.action === "string" ? data.action : "unknown",
      occurredAt,
    };
    if (role === "admin") {
      base.evidenceContext = {
        caseId: typeof data.caseId === "string" ? data.caseId : null,
        reason: typeof data.reason === "string" ? data.reason.slice(0, 300) : "",
      };
    }
    return base;
  });

  return {
    uid: user.uid,
    maskedUid: maskUid(user.uid),
    maskedEmail: maskEmail(user.email),
    maskedDisplayName: maskName(user.displayName),
    verification: { emailVerified: user.emailVerified },
    status: user.disabled || moderationData.accountDisabled === true ? "disabled" : "active",
    trustFlags,
    restrictions: {
      talkRateLimitedUntil: rateLimit && rateLimit.getTime() > Date.now() ? rateLimit.toISOString() : null,
      permanentSuspensionReviewPending:
        Boolean(review && typeof review === "object" && (review as { status?: unknown }).status === "pending"),
    },
    recentModerationHistory,
    lastActivityAt: lastActivity?.toISOString() ?? null,
    version: typeof moderationData.version === "number" ? moderationData.version : 0,
  };
}

function matches(row: UserOperationsRow, filters: UserOperationsFilters): boolean {
  if (filters.verification === "verified" && !row.verification.emailVerified) return false;
  if (filters.verification === "unverified" && row.verification.emailVerified) return false;
  if (filters.status !== "all" && row.status !== filters.status) return false;
  const restricted = row.restrictions.talkRateLimitedUntil !== null || row.restrictions.permanentSuspensionReviewPending;
  if (filters.restriction === "restricted" && !restricted) return false;
  if (filters.restriction === "clear" && restricted) return false;
  if (filters.trust !== "all" && !row.trustFlags.includes(filters.trust)) return false;
  return true;
}

export async function queryUserOperations(filters: UserOperationsFilters, role: AdminRole): Promise<UserOperationsResponse> {
  const auth = getAdminAuth();
  let users: AuthUser[];
  let nextPageToken: string | undefined;
  if (filters.query) {
    try {
      const user = filters.query.includes("@")
        ? await auth.getUserByEmail(filters.query.toLowerCase())
        : await auth.getUser(filters.query);
      users = [user];
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && String(error.code).includes("user-not-found")) {
        users = [];
      } else {
        throw error;
      }
    }
  } else {
    const page = await auth.listUsers(filters.limit, decodePageToken(filters.cursor));
    users = page.users;
    nextPageToken = page.pageToken;
  }

  const rows = await Promise.all(users.map((user) => enrichUser(user, role)));
  return { role, users: rows.filter((row) => matches(row, filters)), pageInfo: { nextCursor: encodePageToken(nextPageToken) } };
}
