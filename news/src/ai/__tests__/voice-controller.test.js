import { describe, expect, it, vi } from 'vitest';
import { cleanSpeechText, createVoiceController } from '../voice-controller.js';

let lastRecognition;

class FakeRecognition {
  constructor() {
    lastRecognition = this;
  }
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
}

class FakeUtterance {
  constructor(text) {
    this.text = text;
  }
}

function fakeWindow() {
  const speechSynthesis = {
    cancel: vi.fn(),
    speak: vi.fn(utterance => {
      utterance.onstart?.();
      utterance.onend?.();
    }),
    getVoices: vi.fn(() => [{ name: 'Arabic voice', lang: 'ar-EG' }]),
  };
  return {
    SpeechRecognition: FakeRecognition,
    SpeechSynthesisUtterance: FakeUtterance,
    speechSynthesis,
  };
}

describe('voice controller', () => {
  it('reports unsupported recognition without blocking fallback input', () => {
    const onError = vi.fn();
    const controller = createVoiceController({ windowRef: {} });
    expect(controller.startListening({ onError })).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('delivers a final transcript once', () => {
    const windowRef = fakeWindow();
    const onFinal = vi.fn();
    const onTranscript = vi.fn();
    const controller = createVoiceController({ windowRef });
    expect(controller.startListening({ onFinal, onTranscript })).toBe(true);

    const result = [{ transcript: 'Explain this article' }];
    result.isFinal = true;
    lastRecognition.onresult({ resultIndex: 0, results: [result] });
    lastRecognition.onresult({ resultIndex: 0, results: [result] });

    expect(onTranscript).toHaveBeenCalledWith('Explain this article');
    expect(onFinal).toHaveBeenCalledTimes(1);
  });

  it('speaks cleaned text with an Arabic voice and supports cancellation', () => {
    const windowRef = fakeWindow();
    const controller = createVoiceController({ windowRef });
    expect(controller.speak('**Answer** https://example.com')).toBe(true);
    const utterance = windowRef.speechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe('Answer');
    expect(utterance.voice.name).toBe('Arabic voice');
    controller.cancelSpeech();
    expect(windowRef.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('removes formatting and URLs from speech text', () => {
    expect(cleanSpeechText('## Result: https://example.com/story')).toBe('Result');
  });

  it('turns symbols and formatting into natural pauses', () => {
    expect(cleanSpeechText('First item - second/item / third **item**!')).toBe('First item. second. item. third item');
    expect(cleanSpeechText('──────')).toBe('');
  });

  it('keeps Arabic words and numbers while dropping non-speech symbols', () => {
    expect(cleanSpeechText('النتيجة #1: نمو 12% / سنويا')).toBe('النتيجة 1. نمو 12. سنويا');
  });
});
