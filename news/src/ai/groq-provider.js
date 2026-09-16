import { AiError, normalizeNetworkError, responseToAiError } from './errors.js';

export const GROQ_API_ROOT = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

export const GROQ_PRIORITY_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'deepseek-r1-distill-llama-70b',
];

function isValidModelName(candidateName) {
  return /^[a-zA-Z0-9._/-]{3,100}$/.test(candidateName);
}

function modelName(requestedName) {
  const raw = String(requestedName || '').trim();
  if (!raw || !isValidModelName(raw)) {
    return DEFAULT_GROQ_MODEL;
  }
  return raw;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function requestWithRetry({ url, options, fetchImpl, signal, retries, delay }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw new AiError('aborted', 'The request was cancelled.');
    try {
      const response = await fetchImpl(url, options);
      if (response.ok) return response;
      const error = await responseToAiError(response, 'Groq');
      if (!error.retryable || attempt === retries) throw error;
      lastError = error;
    } catch (error) {
      const normalized = normalizeNetworkError(error, 'Groq');
      if (!normalized.retryable || attempt === retries) throw normalized;
      lastError = normalized;
    }
    await delay(700 * (2 ** attempt) + Math.floor(Math.random() * 250));
  }
  throw lastError;
}

export async function listGroqModels({
  apiKey,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  if (!apiKey) throw new AiError('invalid-key', 'A Groq API key is required.');
  if (typeof fetchImpl !== 'function') throw new AiError('network', 'Fetch is unavailable.');

  const response = await requestWithRetry({
    url: `${GROQ_API_ROOT}/models`,
    options: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
      referrerPolicy: 'no-referrer',
    },
    fetchImpl,
    signal,
    retries: 0,
    delay: wait,
  });

  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : [];
}

export async function testGroqKey({
  apiKey,
  model = DEFAULT_GROQ_MODEL,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  if (!apiKey) throw new AiError('invalid-key', 'A Groq API key is required.');
  if (typeof fetchImpl !== 'function') throw new AiError('network', 'Fetch is unavailable.');

  const models = await listGroqModels({ apiKey, fetchImpl, signal });
  if (!models.length) {
    throw new AiError('model', 'No active models returned for this Groq key.');
  }

  const modelIds = new Set(models.map(m => m.id));
  let selected = modelName(model);

  // If the requested model is not in this key's models, find the best supported candidate
  if (!modelIds.has(selected)) {
    const matchedPriority = GROQ_PRIORITY_MODELS.find(id => modelIds.has(id));
    selected = matchedPriority || models[0].id;
  }

  return {
    name: selected,
    displayName: `Groq ${selected}`,
  };
}

export async function streamGroqResponse({
  apiKey,
  model = DEFAULT_GROQ_MODEL,
  messages,
  signal,
  onText = () => {},
  fetchImpl = globalThis.fetch,
  delay = wait,
  retries = 1,
} = {}) {
  if (!apiKey) throw new AiError('invalid-key', 'A Groq API key is required.');
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AiError('request', 'Groq messages are required.');
  }
  if (typeof fetchImpl !== 'function') throw new AiError('network', 'Fetch is unavailable.');

  const targetModel = modelName(model);

  const response = await requestWithRetry({
    url: `${GROQ_API_ROOT}/chat/completions`,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        temperature: 0.3,
        max_tokens: 3000,
        stream: true,
      }),
      signal,
      referrerPolicy: 'no-referrer',
    },
    fetchImpl,
    signal,
    retries,
    delay,
  });

  if (!response.body?.getReader) {
    throw new AiError('stream', 'This browser cannot read streaming Groq responses.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let usage = null;

  const processEvent = eventText => {
    const data = eventText
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') return;

    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      throw new AiError('stream', 'Groq returned an unreadable stream.');
    }

    const delta = payload?.choices?.[0]?.delta?.content || '';
    if (delta) {
      fullText += delta;
      onText(delta, fullText);
    }
    usage = payload?.usage || usage;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const eventText of events) processEvent(eventText);
      if (done) break;
    }
    if (buffer.trim()) processEvent(buffer);
  } catch (error) {
    throw normalizeNetworkError(error, 'Groq');
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) {
    throw new AiError('empty', 'Groq returned an empty response.');
  }

  return {
    text: fullText.trim(),
    citations: [],
    usage,
  };
}

function canRetryWithAnotherModel(error) {
  return error?.code === 'model' || error?.code === 'quota';
}

export async function streamGroqWithFallback(streamRequest = {}) {
  const requestedModel = modelName(streamRequest.model);
  try {
    const primaryResponse = await streamGroqResponse({ ...streamRequest, model: requestedModel });
    return { ...primaryResponse, model: requestedModel, fallbackFrom: null };
  } catch (primaryError) {
    if (!canRetryWithAnotherModel(primaryError)) throw primaryError;

    // Discover the exact models available to this key
    let candidateNames = [];
    try {
      const models = await listGroqModels(streamRequest);
      const availableIds = new Set(models.map(m => m.id).filter(Boolean));
      availableIds.delete(requestedModel);
      const priorityMatches = GROQ_PRIORITY_MODELS.filter(id => availableIds.delete(id));
      candidateNames = [...priorityMatches, ...availableIds].slice(0, 4);
    } catch {
      candidateNames = GROQ_PRIORITY_MODELS.filter(name => name !== requestedModel);
    }

    if (candidateNames.length === 0) throw primaryError;

    let lastQuotaError = primaryError.code === 'quota' ? primaryError : null;
    for (const fallbackName of candidateNames) {
      try {
        const fallbackResponse = await streamGroqResponse({ ...streamRequest, model: fallbackName, retries: 0 });
        return { ...fallbackResponse, model: fallbackName, fallbackFrom: requestedModel };
      } catch (fallbackError) {
        if (!canRetryWithAnotherModel(fallbackError)) throw fallbackError;
        if (fallbackError.code === 'quota') lastQuotaError = fallbackError;
      }
    }

    if (lastQuotaError) throw lastQuotaError;
    throw primaryError;
  }
}
