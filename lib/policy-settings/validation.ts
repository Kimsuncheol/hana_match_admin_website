import type { PolicyConfig } from "./types";

export function validatePolicyDraft(config: PolicyConfig, reason: string): string[] {
  const issues: string[] = [];
  if (reason.trim().length < 10 || reason.trim().length > 500) issues.push("변경 사유는 10~500자로 입력하세요.");
  const { autoHideConfidence, escalationConfidence, criticalRiskScore } = config.moderationThresholds;
  if (autoHideConfidence < 0.5 || autoHideConfidence > 1) issues.push("자동 숨김 신뢰도는 0.5~1이어야 합니다.");
  if (escalationConfidence < 0.5 || escalationConfidence > 1) issues.push("에스컬레이션 신뢰도는 0.5~1이어야 합니다.");
  if (autoHideConfidence < escalationConfidence) issues.push("자동 숨김 신뢰도는 에스컬레이션 신뢰도보다 낮을 수 없습니다.");
  if (!Number.isInteger(criticalRiskScore) || criticalRiskScore < 1 || criticalRiskScore > 100) issues.push("중대 위험 점수는 1~100의 정수여야 합니다.");
  if (Object.values(config.ruleVersions).some((value) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value))) issues.push("규칙 버전 식별자 형식을 확인하세요.");
  const expiry = config.reversibleActionExpiryHours;
  if (![expiry.hiddenContent, expiry.talkRateLimit, expiry.warning].every(Number.isInteger) || expiry.hiddenContent < 1 || expiry.hiddenContent > 2160 || expiry.talkRateLimit < 1 || expiry.talkRateLimit > 720 || expiry.warning < 1 || expiry.warning > 8760) issues.push("가역 조치 만료 시간이 허용 범위를 벗어났습니다.");
  const limits = config.talkRateLimits;
  if (![limits.messagesPerMinute, limits.burst, limits.restrictionMinutes].every(Number.isInteger) || limits.messagesPerMinute < 1 || limits.messagesPerMinute > 120 || limits.burst < 1 || limits.burst > limits.messagesPerMinute || limits.restrictionMinutes < 5 || limits.restrictionMinutes > 43200) issues.push("Talk 속도 제한 값을 확인하세요.");
  if (config.escalationRoutes.length < 1 || config.escalationRoutes.length > 10) issues.push("에스컬레이션 경로는 1~10개여야 합니다.");
  if (!config.escalationRoutes.some((route) => route.enabled && route.severity === "critical")) issues.push("활성화된 중대(critical) 경로가 하나 이상 필요합니다.");
  if (new Set(config.escalationRoutes.map((route) => route.destination)).size !== config.escalationRoutes.length) issues.push("에스컬레이션 목적지는 중복될 수 없습니다.");
  if (config.escalationRoutes.some((route) => !/^[a-z0-9][a-z0-9-]{1,47}$/.test(route.destination) || !Number.isInteger(route.slaMinutes) || route.slaMinutes < 5 || route.slaMinutes > 10080)) issues.push("에스컬레이션 목적지 또는 SLA를 확인하세요.");
  const { mode, percentage } = config.rollout;
  if ((mode === "off" || mode === "shadow") && percentage !== 0) issues.push("꺼짐/섀도 모드는 배포 비율이 0이어야 합니다.");
  if (mode === "full" && percentage !== 100) issues.push("전체 배포 모드는 배포 비율이 100이어야 합니다.");
  if (mode === "percentage" && (!Number.isInteger(percentage) || percentage < 1 || percentage > 99)) issues.push("부분 배포 비율은 1~99의 정수여야 합니다.");
  return issues;
}
