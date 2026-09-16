import { AI_STORES, deleteRecord, getRecord, putRecord } from './db.js';

// Keep the original record ID so existing Groq users do not have to re-enter their key.
const ACTIVE_KEY_ID = 'gemini';

export function validateApiKey(value) {
  const key = String(value || '').trim();
  if (!key.startsWith('gsk_') || key.length < 20 || /\s/.test(key)) {
    throw new Error('Enter a valid Groq key starting with gsk_.');
  }
  return key;
}

export async function saveApiKey(value) {
  const key = validateApiKey(value);
  const record = {
    id: ACTIVE_KEY_ID,
    provider: 'groq',
    value: key,
    lastFour: key.slice(-4),
    updatedAt: new Date().toISOString(),
  };
  await putRecord(AI_STORES.secrets, record);
  return { exists: true, lastFour: record.lastFour, updatedAt: record.updatedAt, provider: record.provider };
}

export async function getApiKey() {
  const record = await getRecord(AI_STORES.secrets, ACTIVE_KEY_ID);
  return record?.provider === 'groq' && record?.value?.startsWith('gsk_') ? record.value : null;
}

export async function getApiKeyStatus() {
  const record = await getRecord(AI_STORES.secrets, ACTIVE_KEY_ID);
  const isGroqKey = record?.provider === 'groq' && record?.value?.startsWith('gsk_');
  return isGroqKey
    ? { exists: true, lastFour: record.lastFour, updatedAt: record.updatedAt, provider: 'groq' }
    : { exists: false, lastFour: '', updatedAt: null };
}

export function deleteApiKey() {
  return deleteRecord(AI_STORES.secrets, ACTIVE_KEY_ID);
}
