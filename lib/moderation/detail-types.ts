import type { SlaState } from "@/lib/dashboard/types";
import type { ModerationTargetType } from "./types";

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

export type CaseDetailDto = {
  id: string;
  version: number;
  status: "open" | "in_review" | "resolved" | "dismissed";
  priority: "low" | "medium" | "high" | "critical";
  targetType: ModerationTargetType;
  language: string;
  assignedToUid: string | null;
  contentHidden: boolean;
  talkRateLimitedUntil: string | null;
  maskedEvidence: {
    preview: string;
    redacted: true;
  };
  aiContext: {
    labels: string[];
    confidence: number | null;
    rulesHit: string[];
    suggestion: {
      recommendedAction: string;
      rationale: string;
      policyBasis: string[];
      caution: string;
    } | null;
  };
  userHistory: {
    priorCases: number;
    confirmedViolations: number;
    warnings: number;
    temporaryRestrictions: number;
    accountAgeDays: number | null;
  };
  sla: {
    state: SlaState;
    dueAt: string;
  };
  permanentSuspensionReview: {
    status: "pending";
    requiredApprovals: number;
  } | null;
};

export type ModerationActionInput = {
  caseId: string;
  action: ModerationAction;
  reason: string;
  expectedVersion: number;
  correction?: string;
};

export type ModerationActionResult = {
  ok: true;
  correlationId: string;
  version: number;
  humanReviewRequired: boolean;
};

