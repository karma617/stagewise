export const CONTEXT_PREFLIGHT_FRACTION = 0.75;

export function getContextPreflightCompressionLimit(
  contextWindowSize: number,
): number {
  return Math.max(
    0,
    Math.floor(contextWindowSize * CONTEXT_PREFLIGHT_FRACTION),
  );
}

export function getPostStepCompressionTriggerTokens(
  contextWindowSize: number,
  historyCompressionThreshold: number,
): number {
  return Math.max(0, contextWindowSize * historyCompressionThreshold);
}
