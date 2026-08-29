import { describe, expect, it } from "vitest";
import { canChangeModelRollout, isValidModelDeploymentState, modelDeploymentState, parseModelRolloutInput } from "./modelRollout";

describe("model rollout mutation contract", () => {
  it("allows rollout writes only for an exact superAdmin claim", () => {
    expect(canChangeModelRollout({ admin: true, role: "superAdmin" })).toBe(true);
    expect(canChangeModelRollout({ admin: true, role: "admin" })).toBe(false);
    expect(canChangeModelRollout({ admin: true, role: "moderator" })).toBe(false);
  });

  it("validates mode-specific percentages and a meaningful reason", () => {
    expect(parseModelRolloutInput({ mode: "percentage", percentage: 20, expectedVersion: 3, reason: "검증된 카나리 그룹에 배포합니다." })).toEqual({ mode: "percentage", percentage: 20, expectedVersion: 3, reason: "검증된 카나리 그룹에 배포합니다." });
    expect(parseModelRolloutInput({ mode: "full", percentage: 20, expectedVersion: 3, reason: "잘못된 전체 배포 비율입니다." })).toBeNull();
    expect(parseModelRolloutInput({ mode: "shadow", percentage: 0, expectedVersion: 3, reason: "short" })).toBeNull();
  });

  it("rejects arbitrary deployment/model fields from the client", () => {
    expect(parseModelRolloutInput({ mode: "full", percentage: 100, expectedVersion: 3, reason: "승인된 전체 배포를 시작합니다.", modelVersion: "attacker-model" })).toBeNull();
  });

  it("creates a narrow audit snapshot without model internals", () => {
    const snapshot = modelDeploymentState({ modelVersion: "mod-v8", rolloutMode: "shadow", rolloutPercentage: 0, rollbackTarget: "mod-v7", stateVersion: 2, prompt: "secret", providerConfig: { key: "secret" } });
    expect(snapshot).toEqual({ modelVersion: "mod-v8", rolloutMode: "shadow", rolloutPercentage: 0, rollbackTarget: "mod-v7", stateVersion: 2 });
    expect(JSON.stringify(snapshot)).not.toContain("secret");
    expect(isValidModelDeploymentState(snapshot)).toBe(true);
    expect(isValidModelDeploymentState({ ...snapshot, rolloutPercentage: 120 })).toBe(false);
  });
});
