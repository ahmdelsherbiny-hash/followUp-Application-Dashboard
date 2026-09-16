import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GROQ_MODEL,
  streamGroqResponse,
  streamGroqWithFallback,
  testGroqKey,
} from '../groq-provider.js';

function sseChunkResponse(chunks, status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('Groq provider', () => {
  it('tests a key with Bearer auth against the models endpoint', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('https://api.groq.com/openai/v1/models');
      expect(options.headers.Authorization).toBe('Bearer gsk_test12345678901234567890');
      return new Response(JSON.stringify({
        data: [{ id: 'llama-3.3-70b-versatile' }, { id: 'llama-3.1-8b-instant' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const result = await testGroqKey({
      apiKey: 'gsk_test12345678901234567890',
      model: 'llama-3.3-70b-versatile',
      fetchImpl,
    });

    expect(result.name).toBe('llama-3.3-70b-versatile');
    expect(result.displayName).toBe('Groq llama-3.3-70b-versatile');
  });

  it('streams chat completion deltas and keeps key in Bearer header', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer gsk_secret_key_1234567890');
      const payload = JSON.parse(options.body);
      expect(payload.model).toBe(DEFAULT_GROQ_MODEL);
      expect(payload.stream).toBe(true);

      return sseChunkResponse([
        { choices: [{ delta: { content: 'Marhaban ' } }] },
        { choices: [{ delta: { content: 'bika!' } }] },
      ]);
    });

    const deltas = [];
    const result = await streamGroqResponse({
      apiKey: 'gsk_secret_key_1234567890',
      messages: [{ role: 'user', content: 'Salam' }],
      fetchImpl,
      onText: delta => deltas.push(delta),
    });

    expect(deltas).toEqual(['Marhaban ', 'bika!']);
    expect(result.text).toBe('Marhaban bika!');
  });

  it('normalizes 401 invalid-key errors and redacts echoed key', async () => {
    const key = 'gsk_' + 'x'.repeat(40);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: `Invalid API key provided: ${key}` },
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    let caughtError;
    try {
      await streamGroqResponse({
        apiKey: key,
        messages: [{ role: 'user', content: 'Test' }],
        fetchImpl,
        retries: 0,
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toMatchObject({ code: 'invalid-key', status: 401 });
    expect(caughtError.message).not.toContain(key);
  });

  it('falls back to llama-3.1-8b-instant when primary model encounters 429 quota limit', async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      const payload = JSON.parse(options.body);
      if (payload.model === 'llama-3.3-70b-versatile') {
        return new Response(JSON.stringify({
          error: { message: 'Rate limit reached for model llama-3.3-70b-versatile. Retry later.' },
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
      if (payload.model === 'llama-3.1-8b-instant') {
        return sseChunkResponse([
          { choices: [{ delta: { content: 'Fallback response from 8b' } }] },
        ]);
      }
      throw new Error(`Unexpected model: ${payload.model}`);
    });

    const result = await streamGroqWithFallback({
      apiKey: 'gsk_valid_key_1234567890',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'News analysis' }],
      fetchImpl,
      retries: 0,
    });

    expect(result.text).toBe('Fallback response from 8b');
    expect(result.model).toBe('llama-3.1-8b-instant');
    expect(result.fallbackFrom).toBe('llama-3.3-70b-versatile');
  });

  it('aborts cleanly before fetch if signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();

    await expect(streamGroqResponse({
      apiKey: 'gsk_key_1234567890',
      messages: [{ role: 'user', content: 'Test' }],
      signal: controller.signal,
      fetchImpl,
      retries: 0,
    })).rejects.toMatchObject({ code: 'aborted' });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
