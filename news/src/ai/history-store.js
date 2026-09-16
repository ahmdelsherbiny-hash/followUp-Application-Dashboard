import { AI_STORES, clearStore, deleteRecord, getAllRecords, getRecord, putRecord } from './db.js';

function text(value, maxLength = 12000) {
  return String(value || '').slice(0, maxLength);
}

export function articleSnapshot(article) {
  if (!article?.id) throw new Error('An article ID is required.');
  return {
    id: text(article.id, 200),
    title: text(article.title, 2000),
    summary: text(article.summary),
    url: text(article.url, 4000),
    source: text(article.source, 500),
    publishedAt: text(article.publishedAt, 100),
    language: text(article.language, 20),
  };
}

export function createEmptySession(article) {
  const snapshot = articleSnapshot(article);
  return {
    id: snapshot.id,
    article: snapshot,
    analysis: '',
    citations: [],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function getArticleSession(articleId) {
  return getRecord(AI_STORES.sessions, articleId);
}

export async function saveArticleSession(session) {
  if (!session?.id || !session?.article?.id || session.id !== session.article.id) {
    throw new Error('Article session is invalid.');
  }
  const next = { ...session, updatedAt: new Date().toISOString() };
  await putRecord(AI_STORES.sessions, next);
  return next;
}

export function deleteArticleSession(articleId) {
  return deleteRecord(AI_STORES.sessions, articleId);
}

export function clearAiHistory() {
  return clearStore(AI_STORES.sessions);
}

export function listArticleSessions() {
  return getAllRecords(AI_STORES.sessions);
}

export async function getAiSetting(id, fallback = null) {
  const record = await getRecord(AI_STORES.settings, id);
  return record ? record.value : fallback;
}

export async function setAiSetting(id, value) {
  await putRecord(AI_STORES.settings, { id, value, updatedAt: new Date().toISOString() });
  return value;
}
