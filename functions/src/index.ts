import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { randomUUID } from "node:crypto";
import { resolveAdminAssignment } from "./adminAssignment";
import {
  isDecisionAction,
  moderationState,
  parseModerationActionInput,
  transitionPatch,
} from "./moderationActions";
import {
  canAdministerUsers,
  parseUserOperationInput,
  userOperationPatch,
  userStateSnapshot,
} from "./userOperations";

initializeApp();

// Configure via: firebase functions:config or, for v2, an env var / param
// set at deploy time. Comma-separated domains, no "@". Leave unset to allow
// any domain to receive the default admin role on sign-up.
const adminAllowedEmailDomains = defineString("ADMIN_ALLOWED_EMAIL_DOMAINS", {
  default: "",
});

/**
 * Runs server-side as part of account creation, before the account exists.
 * This is the only place the "admin" custom claim is ever granted — the
 * client never sets or requests it directly, so there is nothing for a
 * browser to spoof or escalate.
 *
 * Requires Identity Platform (blocking functions) to be enabled for this
 * Firebase project: Authentication > Settings > Blocking functions.
 */
export const assignDefaultAdminRole = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user) {
    // No user record on the event: nothing to grant a claim to.
    return { customClaims: { admin: false, role: "unassigned" } };
  }
  const decision = resolveAdminAssignment(user.email, adminAllowedEmailDomains.value());

  logger.info("admin-assignment-decision", {
    uid: user.uid,
    email: user.email,
    ...decision,
  });

  // Best-effort profile write. Blocking functions run under a tight
  // deadline (a few seconds) before the identity platform request times
  // out, so this must stay fast and must never block granting/withholding
  // the claim above.
  try {
    await getFirestore()
      .collection("adminProfiles")
      .doc(user.uid)
      .set({
        email: user.email ?? null,
        role: decision.role,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    logger.error("admin-profile-write-failed", { uid: user.uid, err: String(err) });
  }

  return {
    customClaims: {
      admin: decision.admin,
      role: decision.role,
    },
  };
});

/**
 * The sole write path for case decisions and user-impacting moderation
 * actions. The client cannot submit arbitrary state: it chooses one
 * allowlisted action, while this function derives the transition, actor,
 * correlation id, before/after snapshots, and audit record.
 */
export const moderateCase = onCall(async (request) => {
  const token = request.auth?.token;
  const actorUid = request.auth?.uid;
  const role = token?.role;
  if (!actorUid || token?.admin !== true || (role !== "admin" && role !== "moderator")) {
    throw new HttpsError("permission-denied", "An admin-console role is required.");
  }

  const input = parseModerationActionInput(request.data);
  if (!input) throw new HttpsError("invalid-argument", "Invalid moderation action.");

  const db = getFirestore();
  const caseRef = db.collection("moderationCases").doc(input.caseId);
  const auditRef = db.collection("auditLogs").doc();
  const correlationId = randomUUID();
  const now = new Date();

  const version = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(caseRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "Case not found.");
    const current = snapshot.data() ?? {};
    const currentVersion = typeof current.version === "number" ? current.version : 0;

    if (current.assignedToUid !== actorUid) {
      throw new HttpsError("failed-precondition", "Assign this case to yourself before taking action.");
    }
    if (currentVersion !== input.expectedVersion) {
      throw new HttpsError("aborted", "The case changed. Reload before taking action.");
    }
    const requiresOpenReview = isDecisionAction(input.action) || input.action === "request_permanent_suspension";
    if (requiresOpenReview && current.status !== "open" && current.status !== "in_review") {
      throw new HttpsError("failed-precondition", "This case is no longer reviewable.");
    }
    const pendingReview = current.permanentSuspensionReview as { status?: unknown } | undefined;
    if (input.action === "request_permanent_suspension" && pendingReview?.status === "pending") {
      throw new HttpsError("already-exists", "A permanent suspension review is already pending.");
    }
    if (input.action === "request_permanent_suspension" && typeof current.targetUid !== "string") {
      throw new HttpsError("failed-precondition", "This case has no valid target user.");
    }

    const before = moderationState(current);
    const patch = transitionPatch(current, input, actorUid, now);
    const after = moderationState({ ...current, ...patch });

    const isUserEffect = input.action === "warn_user" || input.action === "rate_limit_talk";
    const targetUid = typeof current.targetUid === "string" ? current.targetUid : null;
    let userModerationRef;
    let userModerationData: Record<string, unknown> = {};
    if (isUserEffect) {
      if (!targetUid) throw new HttpsError("failed-precondition", "This case has no valid target user.");
      userModerationRef = db.collection("userModerationStates").doc(targetUid);
      const userModerationSnapshot = await transaction.get(userModerationRef);
      userModerationData = userModerationSnapshot.data() ?? {};
    }

    transaction.update(caseRef, patch);
    transaction.create(auditRef, {
      correlationId,
      caseId: input.caseId,
      targetUid: typeof current.targetUid === "string" ? current.targetUid : null,
      actorUid,
      actorEmail: typeof token.email === "string" ? token.email : null,
      actorRole: role,
      action: input.action,
      reason: input.reason,
      before,
      after,
      createdAt: FieldValue.serverTimestamp(),
    });

    if (isUserEffect && userModerationRef && targetUid) {
      const talkRateLimitedUntil = input.action === "rate_limit_talk"
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : userModerationData.talkRateLimitedUntil ?? null;
      transaction.set(userModerationRef, {
        warningCount: input.action === "warn_user"
          ? (typeof userModerationData.warningCount === "number" ? userModerationData.warningCount : 0) + 1
          : userModerationData.warningCount ?? 0,
        talkRateLimitedUntil,
        lastAction: input.action,
        lastReason: input.reason,
        lastCorrelationId: correlationId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const effectRef = db.collection("moderationEffects").doc();
      transaction.create(effectRef, {
        correlationId,
        caseId: input.caseId,
        targetUid,
        type: input.action,
        reason: input.reason,
        status: "applied",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    if (input.action === "request_permanent_suspension") {
      const reviewRef = db.collection("humanReviewRequests").doc();
      transaction.create(reviewRef, {
        correlationId,
        caseId: input.caseId,
        targetUid: typeof current.targetUid === "string" ? current.targetUid : null,
        requestedBy: actorUid,
        reason: input.reason,
        status: "pending",
        requiredApprovals: 2,
        approvals: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return currentVersion + 1;
  });

  logger.info("moderation-action-completed", {
    correlationId,
    caseId: input.caseId,
    action: input.action,
    actorUid,
  });

  return {
    ok: true,
    correlationId,
    version,
    humanReviewRequired: input.action === "request_permanent_suspension",
  };
});

/** Full-admin-only account operations. No arbitrary account state is accepted. */
export const administerUser = onCall(async (request) => {
  if (!request.auth?.uid || !canAdministerUsers(request.auth.token)) {
    throw new HttpsError("permission-denied", "The full admin role is required.");
  }
  const input = parseUserOperationInput(request.data);
  if (!input) throw new HttpsError("invalid-argument", "Invalid user operation.");
  if (input.userUid === request.auth.uid && input.action === "disable_account") {
    throw new HttpsError("failed-precondition", "Administrators cannot disable their own account.");
  }

  const db = getFirestore();
  const auth = getAuth();
  const stateRef = db.collection("userModerationStates").doc(input.userUid);
  const correlationId = randomUUID();
  const now = new Date();
  const [authUser, stateSnapshot] = await Promise.all([auth.getUser(input.userUid), stateRef.get()]);
  const current = stateSnapshot.data() ?? {};
  const currentVersion = typeof current.version === "number" ? current.version : 0;
  if (currentVersion !== input.expectedVersion) {
    throw new HttpsError("aborted", "The user state changed. Reload before taking action.");
  }

  if (input.action === "disable_account") await auth.updateUser(input.userUid, { disabled: true });
  if (input.action === "enable_account") await auth.updateUser(input.userUid, { disabled: false });

  const nextVersion = await db.runTransaction(async (transaction) => {
    const freshSnapshot = await transaction.get(stateRef);
    const fresh = freshSnapshot.data() ?? {};
    const freshVersion = typeof fresh.version === "number" ? fresh.version : 0;
    if (freshVersion !== input.expectedVersion) {
      throw new HttpsError("aborted", "The user state changed. Reload before taking action.");
    }
    const patch = userOperationPatch(fresh, input, request.auth!.uid, now);
    const before = userStateSnapshot(authUser.disabled, fresh);
    const afterAuthDisabled = input.action === "disable_account"
      ? true
      : input.action === "enable_account"
        ? false
        : authUser.disabled;
    const after = userStateSnapshot(afterAuthDisabled, { ...fresh, ...patch });
    const auditRef = db.collection("auditLogs").doc();

    transaction.set(stateRef, patch, { merge: true });
    transaction.create(auditRef, {
      correlationId,
      targetUid: input.userUid,
      actorUid: request.auth!.uid,
      actorEmail: typeof request.auth!.token.email === "string" ? request.auth!.token.email : null,
      actorRole: "admin",
      action: input.action,
      reason: input.reason,
      before,
      after,
      createdAt: FieldValue.serverTimestamp(),
    });
    return Number(patch.version);
  });

  logger.info("user-operation-completed", {
    correlationId,
    targetUid: input.userUid,
    action: input.action,
    actorUid: request.auth.uid,
  });
  return { ok: true, correlationId, version: nextVersion };
});
