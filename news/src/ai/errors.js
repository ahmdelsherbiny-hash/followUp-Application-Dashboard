export class AiError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AiError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = Boolean(options.retryable);
  }
}

export function normalizeNetworkError(error, provider = 'AI') {
  if (error?.name === 'AbortError') {
    return new AiError('aborted', 'The request was cancelled.', { cause: error });
  }
  if (error instanceof AiError) return error;
  return new AiError('network', `Could not reach ${provider}. Check the connection and try again.`, {
    cause: error,
    retryable: true,
  });
}

function safeProviderMessage(message) {
  return String(message || '')
    .replace(/gsk_[0-9A-Za-z_-]{20,}/g, '[redacted API key]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

export async function responseToAiError(response, provider = 'Groq') {
  let providerMessage = '';
  try {
    const body = await response.clone().json();
    providerMessage = body?.error?.message || body?.message || '';
  } catch {
    // Provider error bodies are not always JSON.
  }

  const status = response.status;
  if (status === 401 || status === 403) {
    return new AiError('invalid-key', `The ${provider} API key is invalid, expired, or not allowed to use this API.`, { status });
  }
  if (status === 429) {
    const safeMessage = safeProviderMessage(providerMessage);
    const prefix = `${provider} reached a rate or quota limit:`;
    const message = safeMessage
      ? `${prefix} ${safeMessage}`
      : `${provider} reached a rate or quota limit. Try again later.`;
    return new AiError('quota', message, {
      status,
      retryable: true,
    });
  }
  if (status === 408 || status >= 500) {
    return new AiError('service', `${provider} is temporarily unavailable. Try again in a moment.`, {
      status,
      retryable: true,
    });
  }
  if (status === 400 && /api.?key/i.test(providerMessage)) {
    return new AiError('invalid-key', `The ${provider} API key was rejected.`, { status });
  }
  if (status === 404 && /model/i.test(providerMessage)) {
    return new AiError('model', `The selected ${provider} model is not available for this key.`, { status });
  }
  return new AiError('request', providerMessage || `${provider} rejected the request.`, { status });
}
