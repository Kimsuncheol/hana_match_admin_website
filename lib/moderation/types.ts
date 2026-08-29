import type { CasePriority, SlaState } from "@/lib/dashboard/types";

export const TARGET_TYPES = ["profile_photo", "message", "bio", "user_report"] as const;
export type ModerationTargetType = (typeof TARGET_TYPES)[number];

export type AssignmentFilter = "all" | "mine" | "unassigned";

export type ModerationQueueFilters = {
  priority: CasePriority | "all";
  language: string;
  assignment: AssignmentFilter;
  targetType: ModerationTargetType | "all";
  slaRisk: SlaState | "all";
  limit: number;
  cursor?: string;
};

/** Evidence-free DTO approved for the moderation queue client. */
export type ModerationQueueCase = {
  id: string;
  priority: CasePriority;
  language: string;
  targetType: ModerationTargetType;
  summary: string;
  assignedToUid: string | null;
  assignedToLabel: string | null;
  slaState: SlaState;
  slaDueAt: string;
  aiContext: {
    labels: string[];
    confidence: number | null;
  };
};

export type ModerationQueueResponse = {
  items: ModerationQueueCase[];
  pageInfo: {
    nextCursor: string | null;
  };
};

export const DEFAULT_QUEUE_FILTERS: ModerationQueueFilters = {
  priority: "all",
  language: "",
  assignment: "all",
  targetType: "all",
  slaRisk: "all",
  limit: 20,
};

