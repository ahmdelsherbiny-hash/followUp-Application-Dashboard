export const AI_DB_NAME = 'rss_ai_assistant_v1';
export const AI_DB_VERSION = 1;
export const AI_STORES = Object.freeze({
  secrets: 'secrets',
  sessions: 'articleSessions',
  settings: 'aiSettings',
});

let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

export function openAiDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDb.open(AI_DB_NAME, AI_DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      for (const storeName of Object.values(AI_STORES)) {
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    });
    request.addEventListener('success', () => {
      const database = request.result;
      database.addEventListener('versionchange', () => database.close());
      resolve(database);
    }, { once: true });
    request.addEventListener('error', () => {
      databasePromise = undefined;
      reject(request.error);
    }, { once: true });
  });

  return databasePromise;
}

async function run(storeName, mode, operation) {
  const database = await openAiDatabase();
  const transaction = database.transaction(storeName, mode);
  const request = operation(transaction.objectStore(storeName));
  const [result] = await Promise.all([requestResult(request), transactionComplete(transaction)]);
  return result;
}

export function getRecord(storeName, id) {
  return run(storeName, 'readonly', store => store.get(id));
}

export function getAllRecords(storeName) {
  return run(storeName, 'readonly', store => store.getAll());
}

export function putRecord(storeName, value) {
  return run(storeName, 'readwrite', store => store.put(value));
}

export function deleteRecord(storeName, id) {
  return run(storeName, 'readwrite', store => store.delete(id));
}

export function clearStore(storeName) {
  return run(storeName, 'readwrite', store => store.clear());
}

export function resetAiDatabaseConnection() {
  databasePromise?.then(database => database.close()).catch(() => {});
  databasePromise = undefined;
}
