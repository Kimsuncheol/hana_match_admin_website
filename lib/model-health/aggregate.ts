import type { InferenceOutcome, LanguageAgreement, LanguageGroup, ModelDeployment, ModelHealthPayload, ReviewOutcome } from "./types";

const LANGUAGE_GROUPS: readonly LanguageGroup[] = ["ko", "ja", "mixed"];

function percent(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function aggregateModelHealth(
  reviews: ReviewOutcome[],
  inferences: InferenceOutcome[],
  deployment: ModelDeployment,
  now: Date,
): ModelHealthPayload {
  const agreement: LanguageAgreement[] = LANGUAGE_GROUPS.map((language) => {
    let reviewCount = 0;
    let agreedReviews = 0;
    for (const review of reviews) {
      if (review.language !== language) continue;
      reviewCount += 1;
      if (review.agreed) agreedReviews += 1;
    }
    return { language, agreementPct: percent(agreedReviews, reviewCount), agreedReviews, reviewCount };
  });
  let overrides = 0;
  for (const review of reviews) if (review.overridden) overrides += 1;
  let failures = 0;
  for (const inference of inferences) if (!inference.success) failures += 1;

  return {
    role: "admin",
    window: { reviewsDays: 30, inferenceHours: 24, generatedAt: now.toISOString() },
    agreement,
    medianLatencyMs: median(inferences.map((sample) => sample.latencyMs)),
    overrideRatePct: percent(overrides, reviews.length),
    failures,
    inferenceSamples: inferences.length,
    reviewSamples: reviews.length,
    deployment,
  };
}
