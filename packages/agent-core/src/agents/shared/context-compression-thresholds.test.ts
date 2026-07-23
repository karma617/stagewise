import { describe, expect, it } from 'vitest';
import {
  getContextPreflightCompressionLimit,
  getPostStepCompressionTriggerTokens,
} from './context-compression-thresholds';

describe('context compression thresholds', () => {
  it('scales preflight compression with large context windows', () => {
    expect(getContextPreflightCompressionLimit(1_000_000)).toBe(750_000);
  });

  it('scales post-step compression with large context windows', () => {
    expect(getPostStepCompressionTriggerTokens(1_000_000, 0.5)).toBe(500_000);
  });
});
