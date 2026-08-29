export const MODERATION_ACTIONS = [
  "confirm",
  "correct",
  "dismiss",
  "hide_content",
  "restore_content",
  "warn_user",
  "rate_limit_talk",
  "request_permanent_suspension",
] as const;

export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export type ModerationActionInput = {
  caseId: string;
  action: ModerationAction;
  reason: string;
  expectedVersion: number;
  correction?: string;
};

const ACTION_SET = new Set<string>(MODERATION_ACTIONS);
const CASE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_KEYS = new Set(["caseId", "action", "reason", "expectedVersion", "correction"]);

export function parseModerationActionInput(value: unknown): ModerationActionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !ALLOWED_KEYS.has(key))) return null;
  if (typeof data.caseId !== "string" || !CASE_ID_PATTERN.test(data.caseId)) return null;
  if (typeof data.action !== "string" || !ACTION_SET.has(data.action)) return null;
  if (typeof data.reason !== "string") return null;
  const reason = data.reason.trim();
  if (reason.length < 10 || reason.length > 1000) return null;
  if (!Number.isInteger(data.expectedVersion) || Number(data.expectedVersion) < 0) return null;

  const action = data.action as ModerationAction;
  if (action === "correct") {
    if (typeof data.correction !== "string" || data.correction.trim().length < 2 || data.correction.trim().length > 100) {
      return null;
    }
  } else if (data.correction !== undefined) {
    return null;
  }

  return {
    caseId: data.caseId,
    action,
    reason,
    expectedVersion: Number(data.expectedVersion),
    ...(action === "correct" ? { correction: (data.correction as string).trim() } : {}),
  };
}

export function moderationState(data: Record<string, unknown>): Record<string, unknown> {
  return {
    status: data.status ?? null,
    version: typeof data.version === "number" ? data.version : 0,
    assignedToUid: data.assignedToUid ?? null,
    contentHidden: data.contentHidden === true,
    talkRateLimitedUntil: data.talkRateLimitedUntil ?? null,
    warningCount: typeof data.warningCount === "number" ? data.warningCount : 0,
    reviewOutcome: data.reviewOutcome ?? null,
    humanLabel: data.humanLabel ?? null,
    permanentSuspensionReview: data.permanentSuspensionReview ?? null,
  };
}

export function transitionPatch(
  data: Record<string, unknown>,
  input: ModerationActionInput,
  actorUid: string,
  now: Date,
): Record<string, unknown> {
  const currentVersion = typeof data.version === "number" ? data.version : 0;
  const patch: Record<string, unknown> = {
    version: currentVersion + 1,
    lastModerationAction: input.action,
    lastModeratedBy: actorUid,
    lastModeratedAt: now,
  };

  switch (input.action) {
    case "confirm":
      patch.status = "resolved";
      patch.reviewOutcome = "confirmed";
      patch.resolvedAt = now;
      break;
    case "correct":
      patch.status = "resolved";
      patch.reviewOutcome = "corrected";
      patch.humanLabel = input.correction;
      patch.resolvedAt = now;
      break;
    case "dismiss":
      patch.status = "dismissed";
      patch.reviewOutcome = "dismissed";
      patch.resolvedAt = now;
      break;
    case "hide_content":
      patch.contentHidden = true;
      break;
    case "restore_content":
      patch.contentHidden = false;
      break;
    case "warn_user":
      patch.warningCount = (typeof data.warningCount === "number" ? data.warningCount : 0) + 1;
      patch.lastWarningAt = now;
      break;
    case "rate_limit_talk":
      patch.talkRateLimitedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case "request_permanent_suspension":
      patch.status = "in_review";
      patch.permanentSuspensionReview = {
        status: "pending",
        requestedBy: actorUid,
        requestedAt: now,
        requiredApprovals: 2,
        approvals: [],
      };
      break;
  }

  return patch;
}

export function isDecisionAction(action: ModerationAction): boolean {
  return action === "confirm" || action === "correct" || action === "dismiss";
}

