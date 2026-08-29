export const USER_OPERATION_ACTIONS = [
  "disable_account",
  "enable_account",
  "clear_talk_rate_limit",
  "add_trust_flag",
  "remove_trust_flag",
] as const;

export type UserOperationAction = (typeof USER_OPERATION_ACTIONS)[number];
export type TrustFlag = "trusted" | "watch" | "risk";

export type UserOperationInput = {
  userUid: string;
  action: UserOperationAction;
  reason: string;
  expectedVersion: number;
  flag?: TrustFlag;
};

const ACTION_SET = new Set<string>(USER_OPERATION_ACTIONS);
const FLAG_SET = new Set<TrustFlag>(["trusted", "watch", "risk"]);
const ALLOWED_KEYS = new Set(["userUid", "action", "reason", "expectedVersion", "flag"]);
const UID_PATTERN = /^[A-Za-z0-9:_-]{3,128}$/;

export function canAdministerUsers(token: Record<string, unknown> | undefined): boolean {
  return token?.admin === true && (token.role === "admin" || token.role === "superAdmin");
}

export function parseUserOperationInput(value: unknown): UserOperationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !ALLOWED_KEYS.has(key))) return null;
  if (typeof data.userUid !== "string" || !UID_PATTERN.test(data.userUid)) return null;
  if (typeof data.action !== "string" || !ACTION_SET.has(data.action)) return null;
  if (typeof data.reason !== "string" || data.reason.trim().length < 10 || data.reason.trim().length > 1000) return null;
  if (!Number.isInteger(data.expectedVersion) || Number(data.expectedVersion) < 0) return null;

  const action = data.action as UserOperationAction;
  const isFlagAction = action === "add_trust_flag" || action === "remove_trust_flag";
  if (isFlagAction && (typeof data.flag !== "string" || !FLAG_SET.has(data.flag as TrustFlag))) return null;
  if (!isFlagAction && data.flag !== undefined) return null;

  return {
    userUid: data.userUid,
    action,
    reason: data.reason.trim(),
    expectedVersion: Number(data.expectedVersion),
    ...(isFlagAction ? { flag: data.flag as TrustFlag } : {}),
  };
}

export function userStateSnapshot(
  authDisabled: boolean,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return {
    accountDisabled: authDisabled || data.accountDisabled === true,
    trustFlags: Array.isArray(data.trustFlags)
      ? data.trustFlags.filter((flag): flag is string => typeof flag === "string")
      : [],
    talkRateLimitedUntil: data.talkRateLimitedUntil ?? null,
    permanentSuspensionReview: data.permanentSuspensionReview ?? null,
    version: typeof data.version === "number" ? data.version : 0,
  };
}

export function userOperationPatch(
  data: Record<string, unknown>,
  input: UserOperationInput,
  actorUid: string,
  now: Date,
): Record<string, unknown> {
  const flags = new Set(
    Array.isArray(data.trustFlags)
      ? data.trustFlags.filter((flag): flag is string => typeof flag === "string")
      : [],
  );
  if (input.action === "add_trust_flag" && input.flag) flags.add(input.flag);
  if (input.action === "remove_trust_flag" && input.flag) flags.delete(input.flag);

  const patch: Record<string, unknown> = {
    version: (typeof data.version === "number" ? data.version : 0) + 1,
    lastAdminAction: input.action,
    lastAdminActorUid: actorUid,
    lastAdminActionAt: now,
  };
  if (input.action === "disable_account") patch.accountDisabled = true;
  if (input.action === "enable_account") patch.accountDisabled = false;
  if (input.action === "clear_talk_rate_limit") patch.talkRateLimitedUntil = null;
  if (input.action === "add_trust_flag" || input.action === "remove_trust_flag") patch.trustFlags = Array.from(flags).sort();
  return patch;
}
