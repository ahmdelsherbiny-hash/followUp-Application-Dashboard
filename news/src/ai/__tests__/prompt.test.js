import { describe, expect, it } from 'vitest';
import { buildGroqChatMessages, buildGroqInitialMessages, GROQ_SYSTEM_INSTRUCTION, selectedArticleContext } from '../prompt.js';

const selected = {
  id: 'selected-1',
  title: 'Selected headline',
  summary: 'Selected summary',
  source: 'Selected source',
  publishedAt: '2026-09-16T00:00:00.000Z',
  url: 'https://example.com/selected',
};

describe('article-scoped prompts', () => {
  it('uses fixed safety and fluency rules for every Groq request', () => {
    expect(buildGroqInitialMessages(selected)[0].content).toBe(GROQ_SYSTEM_INSTRUCTION);
    expect(buildGroqChatMessages(selected, { messages: [] })[0].content).toContain(GROQ_SYSTEM_INSTRUCTION);
  });

  it('serializes only the selected article fields', () => {
    expect(selectedArticleContext(selected)).toEqual({
      id: selected.id,
      title: selected.title,
      rssSummary: selected.summary,
      source: selected.source,
      publishedAt: selected.publishedAt,
      url: selected.url,
    });
  });

  it('builds initial Groq messages without unrelated dashboard content', () => {
    const serialized = JSON.stringify(buildGroqInitialMessages(selected));
    expect(serialized).toContain('Selected headline');
    expect(serialized).toContain('https://example.com/selected');
    expect(serialized).not.toContain('Unrelated dashboard headline');
  });

  it('keeps follow-up history scoped to the selected session', () => {
    const messages = buildGroqChatMessages(selected, {
      analysis: 'Saved selected analysis',
      messages: [
        { role: 'user', text: 'Selected question' },
        { role: 'model', text: 'Selected answer' },
      ],
    });
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain('selected-1');
    expect(serialized).toContain('Selected question');
    expect(serialized).not.toContain('article-2');
  });
});
