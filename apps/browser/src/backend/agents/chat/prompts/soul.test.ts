import { describe, expect, it } from 'vitest';
import browserSoulPrompt from './soul.md?raw';

describe('browser chat soul prompt', () => {
  it('tells the agent to reply in Chinese', () => {
    expect(browserSoulPrompt).toContain(
      'Always reply in Chinese.',
    );
  });

  it('includes authorized security assessment instructions', () => {
    expect(browserSoulPrompt).toContain(
      'qualified cybersecurity engineer',
    );
    expect(browserSoulPrompt).toContain(
      'Open Source Intelligence (OSINT) activities',
    );
    expect(browserSoulPrompt).toContain(
      'Risk Level',
    );
    expect(browserSoulPrompt).toContain(
      'Emergency Rollback Recommendation',
    );
  });

  it('includes the business-first final task report format', () => {
    expect(browserSoulPrompt).toContain(
      '### Final Task Report Format',
    );
    expect(browserSoulPrompt).toContain(
      'Business conclusion',
    );
    expect(browserSoulPrompt).toContain(
      'Validated successfully',
    );
    expect(browserSoulPrompt).toContain(
      'Files changed in this turn',
    );
    expect(browserSoulPrompt).toContain(
      '业务结论',
    );
  });
});
