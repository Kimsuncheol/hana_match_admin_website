import { describe, expect, it } from "vitest";
import {
  canAdministerUsers,
  parseUserOperationInput,
  userOperationPatch,
  userStateSnapshot,
} from "./userOperations";

describe("privileged user operations", () => {
  it("denies writes from moderators and unclaimed users", () => {
    expect(canAdministerUsers({ admin: true, role: "moderator" })).toBe(false);
    expect(canAdministerUsers({ admin: false, role: "admin" })).toBe(false);
    expect(canAdministerUsers(undefined)).toBe(false);
    expect(canAdministerUsers({ admin: true, role: "admin" })).toBe(true);
    expect(canAdministerUsers({ admin: true, role: "superAdmin" })).toBe(true);
  });

  it("denies arbitrary account-state fields from the client", () => {
    expect(parseUserOperationInput({
      userUid: "user-1",
      action: "disable_account",
      reason: "운영 정책에 따라 계정을 비활성화합니다.",
      expectedVersion: 2,
      disabled: true,
    })).toBeNull();
    expect(parseUserOperationInput({
      userUid: "user-1",
      action: "permanent_suspend",
      reason: "허용되지 않은 직접 영구 정지 요청입니다.",
      expectedVersion: 2,
    })).toBeNull();
  });

  it("requires valid flags only for flag actions", () => {
    expect(parseUserOperationInput({
      userUid: "user-1",
      action: "add_trust_flag",
      flag: "risk",
      reason: "반복 위반 패턴으로 위험 플래그를 추가합니다.",
      expectedVersion: 1,
    })).toMatchObject({ action: "add_trust_flag", flag: "risk" });
    expect(parseUserOperationInput({
      userUid: "user-1",
      action: "disable_account",
      flag: "risk",
      reason: "허용되지 않은 추가 필드가 포함되어 있습니다.",
      expectedVersion: 1,
    })).toBeNull();
  });

  it("derives a narrow state patch and increments version", () => {
    expect(userOperationPatch(
      { version: 3, trustFlags: ["watch"] },
      { userUid: "user-1", action: "add_trust_flag", flag: "risk", reason: "위험 신호가 추가로 확인되었습니다.", expectedVersion: 3 },
      "admin-1",
      new Date("2026-08-29T10:00:00Z"),
    )).toMatchObject({ version: 4, trustFlags: ["risk", "watch"], lastAdminActorUid: "admin-1" });
  });

  it("keeps sensitive identity and evidence out of audit snapshots", () => {
    const snapshot = userStateSnapshot(false, {
      version: 1,
      trustFlags: ["watch"],
      email: "private@example.com",
      phoneNumber: "010-1234-5678",
      rawEvidence: "secret",
    });
    expect(snapshot).not.toHaveProperty("email");
    expect(snapshot).not.toHaveProperty("phoneNumber");
    expect(JSON.stringify(snapshot)).not.toContain("secret");
  });
});
