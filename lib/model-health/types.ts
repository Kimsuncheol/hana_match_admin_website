import type { RolloutMode } from "@/lib/policy-settings/types";
export type { RolloutMode } from "@/lib/policy-settings/types";

export type LanguageGroup = "ko" | "ja" | "mixed";

export type ReviewOutcome = {
  language: LanguageGroup;
  agreed: boolean;
  overridden: boolean;
};

export type InferenceOutcome = {
  latencyMs: number;
  success: boolean;
};

export type ModelDeployment = {
  modelVersion: string;
  rolloutMode: RolloutMode;
  rolloutPercentage: number;
  rollbackTarget: string | null;
  stateVersion: number;
  updatedAt: string | null;
};

export type LanguageAgreement = {
  language: LanguageGroup;
  agreementPct: number | null;
  agreedReviews: number;
  reviewCount: number;
};

export type ModelHealthPayload = {
  role: "admin";
  window: { reviewsDays: number; inferenceHours: number; generatedAt: string };
  agreement: LanguageAgreement[];
  medianLatencyMs: number | null;
  overrideRatePct: number | null;
  failures: number;
  inferenceSamples: number;
  reviewSamples: number;
  deployment: ModelDeployment;
};

export type RolloutModeChangeInput = {
  mode: RolloutMode;
  percentage: number;
  expectedVersion: number;
  reason: string;
};

export type RolloutModeChangeResult = {
  ok: true;
  correlationId: string;
  stateVersion: number;
  rolloutMode: RolloutMode;
  rolloutPercentage: number;
  rollbackTarget: string | null;
};
