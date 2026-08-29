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
import {
  canManagePolicy,
  DEFAULT_POLICY_CONFIG,
  parsePolicyConfig,
  parsePolicyMutationInput,
} from "./policySettings";
import { canChangeModelRollout, isValidModelDeploymentState, modelDeploymentState, parseModelRolloutInput } from "./modelRollout";

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
  if (!actorUid || token?.admin !== true || (role !== "superAdmin" && role !== "admin" && role !== "moderator")) {
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
      actorRole: request.auth!.token.role === "superAdmin" ? "superAdmin" : "admin",
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

/**
 * Super-admin-only read path for policy state. Firestore is never queried
 * by the browser, and only the constrained policy DTO and rollback metadata
 * are returned.
 */
export const getPolicySettings = onCall(async (request) => {
  if (!request.auth?.uid || !canManagePolicy(request.auth.token)) {
    throw new HttpsError("permission-denied", "The superAdmin role is required.");
  }
  if (!request.data || typeof request.data !== "object" || Array.isArray(request.data) || Object.keys(request.data).length !== 0) {
    throw new HttpsError("invalid-argument", "Policy reads do not accept query fields.");
  }

  const db = getFirestore();
  const [currentSnapshot, historySnapshot] = await Promise.all([
    db.collection("policySettings").doc("current").get(),
    db.collection("policyVersions").orderBy("version", "desc").limit(20).get(),
  ]);

  if (!currentSnapshot.exists) {
    return { current: { version: 0, versionId: null, config: DEFAULT_POLICY_CONFIG, updatedAt: null }, versions: [] };
  }

  const current = currentSnapshot.data() ?? {};
  const currentConfig = parsePolicyConfig(current.config);
  if (!currentConfig.ok || typeof current.version !== "number" || typeof current.versionId !== "string") {
    logger.error("policy-current-invalid", { currentVersion: current.version ?? null });
    throw new HttpsError("internal", "Stored policy state is invalid.");
  }

  const versions = historySnapshot.docs.flatMap((document) => {
    const data = document.data();
    if (typeof data.version !== "number" || typeof data.reason !== "string") return [];
    return [{
      versionId: document.id,
      version: data.version,
      reason: data.reason,
      operation: data.operation === "rollback" ? "rollback" : "publish",
      createdAt: typeof data.createdAt?.toDate === "function" ? data.createdAt.toDate().toISOString() : null,
      rollbackTargetId: typeof data.rollbackTargetId === "string" ? data.rollbackTargetId : null,
    }];
  });

  return {
    current: {
      version: current.version,
      versionId: current.versionId,
      config: currentConfig.value,
      updatedAt: typeof current.updatedAt?.toDate === "function" ? current.updatedAt.toDate().toISOString() : null,
    },
    versions,
  };
});

/**
 * Publishes a new immutable version or rolls back by copying an immutable
 * prior version into a new head. Client input never controls actor/audit
 * metadata or arbitrary document fields.
 */
export const mutatePolicySettings = onCall(async (request) => {
  if (!request.auth?.uid || !canManagePolicy(request.auth.token)) {
    throw new HttpsError("permission-denied", "The superAdmin role is required.");
  }
  const parsed = parsePolicyMutationInput(request.data);
  if (!parsed.ok) throw new HttpsError("invalid-argument", parsed.issues.join(" "));

  const input = parsed.value;
  const db = getFirestore();
  const currentRef = db.collection("policySettings").doc("current");
  const versionRef = db.collection("policyVersions").doc(randomUUID());
  const auditRef = db.collection("auditLogs").doc(randomUUID());
  const correlationId = randomUUID();

  const result = await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(currentRef);
    const current = currentSnapshot.data() ?? {};
    const currentVersion = typeof current.version === "number" ? current.version : 0;
    const currentVersionId = typeof current.versionId === "string" ? current.versionId : null;
    if (currentSnapshot.exists && (!currentVersionId || !parsePolicyConfig(current.config).ok)) {
      throw new HttpsError("failed-precondition", "Current policy state is invalid.");
    }
    if (currentVersion !== input.expectedVersion) {
      throw new HttpsError("aborted", "Policy state changed. Reload before publishing.");
    }

    let nextConfig;
    let sourceVersionId: string | null = null;
    if (input.operation === "publish") {
      nextConfig = input.config;
    } else {
      if (input.targetVersionId === currentVersionId) {
        throw new HttpsError("failed-precondition", "The current version cannot be its own rollback target.");
      }
      const targetRef = db.collection("policyVersions").doc(input.targetVersionId);
      const targetSnapshot = await transaction.get(targetRef);
      if (!targetSnapshot.exists) throw new HttpsError("not-found", "Rollback target not found.");
      const targetData = targetSnapshot.data() ?? {};
      const targetConfig = parsePolicyConfig(targetData.config);
      if (!targetConfig.ok || typeof targetData.version !== "number" || targetData.version >= currentVersion) {
        throw new HttpsError("failed-precondition", "Rollback target is invalid or not older than the current policy.");
      }
      nextConfig = targetConfig.value;
      sourceVersionId = input.targetVersionId;
    }

    const nextVersion = currentVersion + 1;
    const before = currentSnapshot.exists
      ? { version: currentVersion, versionId: currentVersionId, config: current.config ?? null }
      : null;
    const after = { version: nextVersion, versionId: versionRef.id, config: nextConfig };
    const versionDocument = {
      ...after,
      operation: input.operation,
      reason: input.reason,
      rollbackTargetId: currentVersionId,
      sourceVersionId,
      correlationId,
      createdBy: request.auth!.uid,
      createdAt: FieldValue.serverTimestamp(),
    };

    transaction.create(versionRef, versionDocument);
    transaction.set(currentRef, {
      ...after,
      rollbackTargetId: currentVersionId,
      correlationId,
      updatedBy: request.auth!.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      correlationId,
      actorUid: request.auth!.uid,
      actorEmail: typeof request.auth!.token.email === "string" ? request.auth!.token.email : null,
      actorRole: "superAdmin",
      action: input.operation === "rollback" ? "rollback_policy_settings" : "publish_policy_settings",
      reason: input.reason,
      before,
      after,
      rollbackPath: {
        rollbackTargetId: currentVersionId,
        sourceVersionId,
        publishedVersionId: versionRef.id,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    return { version: nextVersion, versionId: versionRef.id, rollbackTargetId: currentVersionId };
  });

  logger.info("policy-settings-mutated", {
    correlationId,
    operation: input.operation,
    actorUid: request.auth.uid,
    version: result.version,
  });
  return { ok: true, correlationId, ...result };
});

/** Super-admin-only rollout-mode mutation. Model identity and rollback target are server-owned. */
export const changeModelRollout = onCall(async (request) => {
  if (!request.auth?.uid || !canChangeModelRollout(request.auth.token)) {
    throw new HttpsError("permission-denied", "The superAdmin role is required.");
  }
  const input = parseModelRolloutInput(request.data);
  if (!input) throw new HttpsError("invalid-argument", "Invalid rollout-mode change.");

  const db = getFirestore();
  const deploymentRef = db.collection("modelDeployments").doc("current");
  const auditRef = db.collection("auditLogs").doc(randomUUID());
  const correlationId = randomUUID();

  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(deploymentRef);
    if (!snapshot.exists) throw new HttpsError("failed-precondition", "No deployed model is configured.");
    const current = snapshot.data() ?? {};
    const before = modelDeploymentState(current);
    if (!isValidModelDeploymentState(before)) {
      throw new HttpsError("failed-precondition", "The deployed model state is invalid.");
    }
    if (before.stateVersion !== input.expectedVersion) {
      throw new HttpsError("aborted", "Model rollout state changed. Reload before updating.");
    }
    if (before.rolloutMode === input.mode && before.rolloutPercentage === input.percentage) {
      throw new HttpsError("failed-precondition", "The requested rollout mode is already active.");
    }

    const nextVersion = before.stateVersion + 1;
    const after = { ...before, rolloutMode: input.mode, rolloutPercentage: input.percentage, stateVersion: nextVersion };
    transaction.update(deploymentRef, {
      rolloutMode: input.mode,
      rolloutPercentage: input.percentage,
      stateVersion: nextVersion,
      lastCorrelationId: correlationId,
      updatedBy: request.auth!.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      correlationId,
      actorUid: request.auth!.uid,
      actorEmail: typeof request.auth!.token.email === "string" ? request.auth!.token.email : null,
      actorRole: "superAdmin",
      action: "change_model_rollout_mode",
      reason: input.reason,
      before,
      after,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { stateVersion: nextVersion, rolloutMode: input.mode, rolloutPercentage: input.percentage, rollbackTarget: before.rollbackTarget };
  });

  logger.info("model-rollout-mode-changed", { correlationId, actorUid: request.auth.uid, ...result });
  return { ok: true, correlationId, ...result };
});
