export type ModelRolloutMode = "off" | "shadow" | "percentage" | "full";
export type ModelRolloutInput = { mode: ModelRolloutMode; percentage: number; expectedVersion: number; reason: string };

const MODES = new Set<ModelRolloutMode>(["off", "shadow", "percentage", "full"]);
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function canChangeModelRollout(token: Record<string, unknown> | null | undefined): boolean {
  return token?.admin === true && token.role === "superAdmin";
}

export function parseModelRolloutInput(value: unknown): ModelRolloutInput | null {
  if (!object(value) || Object.keys(value).length !== 4 || !["mode", "percentage", "expectedVersion", "reason"].every((key) => key in value)) return null;
  if (typeof value.mode !== "string" || !MODES.has(value.mode as ModelRolloutMode)) return null;
  if (!Number.isInteger(value.percentage) || Number(value.percentage) < 0 || Number(value.percentage) > 100) return null;
  if (!Number.isInteger(value.expectedVersion) || Number(value.expectedVersion) < 0) return null;
  if (typeof value.reason !== "string" || value.reason.trim().length < 10 || value.reason.trim().length > 500) return null;
  const mode = value.mode as ModelRolloutMode;
  const percentage = Number(value.percentage);
  if ((mode === "off" || mode === "shadow") && percentage !== 0) return null;
  if (mode === "full" && percentage !== 100) return null;
  if (mode === "percentage" && (percentage < 1 || percentage > 99)) return null;
  return { mode, percentage, expectedVersion: Number(value.expectedVersion), reason: value.reason.trim() };
}

export function modelDeploymentState(data: Record<string, unknown>) {
  return {
    modelVersion: typeof data.modelVersion === "string" ? data.modelVersion : null,
    rolloutMode: typeof data.rolloutMode === "string" ? data.rolloutMode : null,
    rolloutPercentage: typeof data.rolloutPercentage === "number" ? data.rolloutPercentage : null,
    rollbackTarget: typeof data.rollbackTarget === "string" ? data.rollbackTarget : null,
    stateVersion: typeof data.stateVersion === "number" ? data.stateVersion : 0,
  };
}

export function isValidModelDeploymentState(state: ReturnType<typeof modelDeploymentState>): boolean {
  if (!state.modelVersion || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(state.modelVersion)) return false;
  if (state.rollbackTarget !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(state.rollbackTarget)) return false;
  if (!Number.isInteger(state.stateVersion) || state.stateVersion < 0) return false;
  if (!state.rolloutMode || !MODES.has(state.rolloutMode as ModelRolloutMode) || state.rolloutPercentage === null || !Number.isInteger(state.rolloutPercentage)) return false;
  if ((state.rolloutMode === "off" || state.rolloutMode === "shadow") && state.rolloutPercentage !== 0) return false;
  if (state.rolloutMode === "full" && state.rolloutPercentage !== 100) return false;
  return state.rolloutMode !== "percentage" || (state.rolloutPercentage >= 1 && state.rolloutPercentage <= 99);
}
