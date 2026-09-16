// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAssistantView } from '../assistant-view.js';

afterEach(() => {
  document.body.replaceChildren();
});

describe('assistant view', () => {
  it('opens from the global FAB and closes through callbacks', () => {
    const onOpenLast = vi.fn();
    const onClose = vi.fn();
    const view = createAssistantView({ onOpenLast, onClose }, document);

    view.getRoot().querySelector('[data-ai-action="open-last"]').click();
    expect(onOpenLast).toHaveBeenCalledOnce();

    view.open();
    expect(view.isOpen()).toBe(true);
    view.getRoot().querySelector('[data-ai-action="close"]').click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders model text as text instead of executable HTML', () => {
    const view = createAssistantView({}, document);
    view.setAnalysis('<img src=x onerror="alert(1)">');
    const output = view.getRoot().querySelector('[data-ai-analysis]');
    expect(output.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(output.querySelector('img')).toBeNull();
  });

  it('allows only HTTPS citations', () => {
    const view = createAssistantView({}, document);
    view.setCitations([
      { url: 'javascript:alert(1)', title: 'Unsafe' },
      { url: 'https://example.com/story', title: 'Safe' },
    ]);
    const links = [...view.getRoot().querySelectorAll('[data-ai-sources] a')];
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://example.com/story');
  });

  it('submits key and text input through explicit callbacks', () => {
    const onSaveKey = vi.fn();
    const onSend = vi.fn();
    const view = createAssistantView({ onSaveKey, onSend }, document);
    const root = view.getRoot();

    root.querySelector('#aiApiKey').value = 'gsk_test-key-12345678901234567890';
    root.querySelector('[data-ai-form="key"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSaveKey).toHaveBeenCalledWith('gsk_test-key-12345678901234567890');

    root.querySelector('#aiQuestion').value = 'What is the impact?';
    root.querySelector('[data-ai-form="message"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(onSend).toHaveBeenCalledWith('What is the impact?', 'text');
  });

  it('exposes only Groq setup and settings', () => {
    const view = createAssistantView({}, document);
    const root = view.getRoot();
    expect(root.querySelector('#aiProvider')).toBeNull();
    expect(root.querySelector('#aiSettingsProvider')).toBeNull();
    expect(root.textContent).toContain('Groq');
    expect(root.textContent).not.toMatch(/Gemini/i);
  });

  it('prevents duplicate submissions while a request is active', () => {
    const view = createAssistantView({}, document);
    view.setBusy(true);

    const guardedControls = [...view.getRoot().querySelectorAll('[data-ai-busy-sensitive]')];
    expect(guardedControls.length).toBeGreaterThan(3);
    expect(guardedControls.every(control => control.disabled)).toBe(true);
  });
});
