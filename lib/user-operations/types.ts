export type VerificationFilter = "all" | "verified" | "unverified";
export type UserStatusFilter = "all" | "active" | "disabled";
export type RestrictionFilter = "all" | "restricted" | "clear";
export type TrustFilter = "all" | "trusted" | "watch" | "risk";

export type UserOperationsFilters = {
  query: string;
  verification: VerificationFilter;
  status: UserStatusFilter;
  restriction: RestrictionFilter;
  trust: TrustFilter;
  limit: number;
  cursor?: string;
};

export type UserModerationHistoryItem = {
  action: string;
  occurredAt: string;
  evidenceContext?: {
    caseId: string | null;
    reason: string;
  };
};

export type UserOperationsRow = {
  uid: string;
  maskedUid: string;
  maskedEmail: string;
  maskedDisplayName: string | null;
  verification: {
    emailVerified: boolean;
  };
  status: "active" | "disabled";
  trustFlags: string[];
  restrictions: {
    talkRateLimitedUntil: string | null;
    permanentSuspensionReviewPending: boolean;
  };
  recentModerationHistory: UserModerationHistoryItem[];
  lastActivityAt: string | null;
  version: number;
};

export type UserOperationsResponse = {
  role: "admin" | "moderator";
  users: UserOperationsRow[];
  pageInfo: { nextCursor: string | null };
};

export const DEFAULT_USER_FILTERS: UserOperationsFilters = {
  query: "",
  verification: "all",
  status: "all",
  restriction: "all",
  trust: "all",
  limit: 20,
};

export const USER_OPERATION_ACTIONS = [
  "disable_account",
  "enable_account",
  "clear_talk_rate_limit",
  "add_trust_flag",
  "remove_trust_flag",
] as const;

export type UserOperationAction = (typeof USER_OPERATION_ACTIONS)[number];

export type UserOperationInput = {
  userUid: string;
  action: UserOperationAction;
  reason: string;
  expectedVersion: number;
  flag?: "trusted" | "watch" | "risk";
};

export type UserOperationResult = {
  ok: true;
  correlationId: string;
  version: number;
};

