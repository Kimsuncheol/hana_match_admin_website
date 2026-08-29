import "server-only";
import { getAdminFirestore } from "./server";
import type { InferenceOutcome, LanguageGroup, ModelDeployment, ReviewOutcome } from "@/lib/model-health/types";

const REVIEW_WINDOW_DAYS = 30;
const INFERENCE_WINDOW_HOURS = 24;
const QUERY_LIMIT = 5000;
const LANGUAGES = new Set<LanguageGroup>(["ko", "ja", "mixed"]);

function dateIso(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") return (value as { toDate(): Date }).toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function fetchModelHealthInputs(): Promise<{ reviews: ReviewOutcome[]; inferences: InferenceOutcome[]; deployment: ModelDeployment }> {
  const db = getAdminFirestore();
  const now = Date.now();
  const [reviewsSnapshot, inferenceSnapshot, deploymentSnapshot] = await Promise.all([
    db.collection("moderationReviewOutcomes").where("reviewedAt", ">=", new Date(now - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000)).orderBy("reviewedAt", "desc").limit(QUERY_LIMIT).get(),
    db.collection("aiLatencyLogs").where("recordedAt", ">=", new Date(now - INFERENCE_WINDOW_HOURS * 60 * 60 * 1000)).orderBy("recordedAt", "desc").limit(QUERY_LIMIT).get(),
    db.collection("modelDeployments").doc("current").get(),
  ]);

  const reviews = reviewsSnapshot.docs.flatMap((document): ReviewOutcome[] => {
    const data = document.data();
    if (typeof data.languageGroup !== "string" || !LANGUAGES.has(data.languageGroup as LanguageGroup) || typeof data.humanAgreedWithAi !== "boolean" || typeof data.overridden !== "boolean") return [];
    return [{ language: data.languageGroup as LanguageGroup, agreed: data.humanAgreedWithAi, overridden: data.overridden }];
  });
  const inferences = inferenceSnapshot.docs.flatMap((document): InferenceOutcome[] => {
    const data = document.data();
    if (typeof data.latencyMs !== "number" || !Number.isFinite(data.latencyMs) || data.latencyMs < 0 || typeof data.success !== "boolean") return [];
    return [{ latencyMs: data.latencyMs, success: data.success }];
  });
  const deploymentData = deploymentSnapshot.data() ?? {};
  const mode = ["off", "shadow", "percentage", "full"].includes(deploymentData.rolloutMode) ? deploymentData.rolloutMode : "off";
  const percentage = typeof deploymentData.rolloutPercentage === "number" && Number.isInteger(deploymentData.rolloutPercentage) && deploymentData.rolloutPercentage >= 0 && deploymentData.rolloutPercentage <= 100 ? deploymentData.rolloutPercentage : 0;
  const deployment: ModelDeployment = {
    modelVersion: typeof deploymentData.modelVersion === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(deploymentData.modelVersion) ? deploymentData.modelVersion : "unconfigured",
    rolloutMode: mode,
    rolloutPercentage: percentage,
    rollbackTarget: typeof deploymentData.rollbackTarget === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(deploymentData.rollbackTarget) ? deploymentData.rollbackTarget : null,
    stateVersion: typeof deploymentData.stateVersion === "number" && Number.isInteger(deploymentData.stateVersion) && deploymentData.stateVersion >= 0 ? deploymentData.stateVersion : 0,
    updatedAt: dateIso(deploymentData.updatedAt),
  };
  return { reviews, inferences, deployment };
}
