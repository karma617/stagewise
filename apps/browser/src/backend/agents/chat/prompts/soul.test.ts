import { describe, expect, it } from 'vitest';
import browserSoulPrompt from './soul.md?raw';

describe('browser chat soul prompt', () => {
  it('tells the agent to reply in the user language', () => {
    expect(browserSoulPrompt).toContain(
      'Reply entirely in the user\'s latest message language.',
    );
    expect(browserSoulPrompt).toContain(
      'Switch immediately when the user\'s language changes.',
    );
  });
});
