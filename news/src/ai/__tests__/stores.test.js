import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AI_DB_NAME, resetAiDatabaseConnection } from '../db.js';
import { clearAiHistory, createEmptySession, getArticleSession, saveArticleSession } from '../history-store.js';
import { deleteApiKey, getApiKey, getApiKeyStatus, saveApiKey } from '../key-store.js';

function deleteDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(AI_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
  });
}

beforeEach(async () => {
  resetAiDatabaseConnection();
  await Promise.resolve();
  await deleteDatabase();
  resetAiDatabaseConnection();
});

describe('local AI stores', () => {
  it('saves, masks, replaces, and deletes the Groq key', async () => {
    await saveApiKey('gsk_test-key-12345678901234567890');
    expect(await getApiKey()).toBe('gsk_test-key-12345678901234567890');
    expect(await getApiKeyStatus()).toMatchObject({ exists: true, lastFour: '7890' });

    await saveApiKey('gsk_replacement-abcdefghij123456789');
    expect(await getApiKey()).toBe('gsk_replacement-abcdefghij123456789');

    await deleteApiKey();
    expect(await getApiKey()).toBeNull();
    expect(await getApiKeyStatus()).toEqual({ exists: false, lastFour: '', updatedAt: null });
  });

  it('keeps sessions isolated by article ID', async () => {
    const one = createEmptySession({ id: 'article-1', title: 'One', url: 'https://example.com/one' });
    const two = createEmptySession({ id: 'article-2', title: 'Two', url: 'https://example.com/two' });
    one.analysis = 'Analysis one';
    two.analysis = 'Analysis two';

    await saveArticleSession(one);
    await saveArticleSession(two);

    expect((await getArticleSession('article-1')).analysis).toBe('Analysis one');
    expect((await getArticleSession('article-2')).analysis).toBe('Analysis two');
  });

  it('clears AI history without deleting the API key', async () => {
    await saveApiKey('gsk_test-key-12345678901234567890');
    await saveArticleSession(createEmptySession({ id: 'article-1', title: 'One' }));

    await clearAiHistory();

    expect(await getArticleSession('article-1')).toBeUndefined();
    expect(await getApiKey()).toBe('gsk_test-key-12345678901234567890');
  });
});
