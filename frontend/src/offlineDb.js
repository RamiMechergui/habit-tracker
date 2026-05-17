/**
 * offlineDb.js — IndexedDB-based persistence layer for Evolvia
 *
 * Stores user data locally so the app works fully offline.
 * All reads/writes are async and return promises.
 */

const DB_NAME = 'evolvia_offline';
const DB_VERSION = 2;

// Object store names
const STORES = {
  LOGS:       'logs',
  USER:       'user',
  CATEGORIES: 'categories',
  BOOK:       'currentBook',
  ARCHIVES:   'archives',
  SYNC_QUEUE: 'syncQueue',
  NOTES:      'notes',         // Daily notes keyed by _id
};

let dbInstance = null;

/**
 * Open (or create) the IndexedDB database.
 * Returns a cached reference after first call.
 */
function openDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Daily logs — key = date string (yyyy-MM-dd)
      if (!db.objectStoreNames.contains(STORES.LOGS)) {
        db.createObjectStore(STORES.LOGS, { keyPath: 'date' });
      }

      // User profile — single row, key = 'profile'
      if (!db.objectStoreNames.contains(STORES.USER)) {
        db.createObjectStore(STORES.USER, { keyPath: 'id' });
      }

      // Expense categories — single row, key = 'cats'
      if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
        db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
      }

      // Current book — single row, key = 'book'
      if (!db.objectStoreNames.contains(STORES.BOOK)) {
        db.createObjectStore(STORES.BOOK, { keyPath: 'id' });
      }

      // Archived books — auto-increment
      if (!db.objectStoreNames.contains(STORES.ARCHIVES)) {
        db.createObjectStore(STORES.ARCHIVES, { keyPath: 'id', autoIncrement: true });
      }

      // Sync queue — auto-increment, ordered
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Daily notes — key = _id (string). Created in v2.
      if (!db.objectStoreNames.contains(STORES.NOTES)) {
        const notesStore = db.createObjectStore(STORES.NOTES, { keyPath: '_id' });
        notesStore.createIndex('date', 'date', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ── Generic helpers ──────────────────────────────────────────────

async function getItem(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteItem(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getAllItems(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Public API ───────────────────────────────────────────────────

// Logs
export async function saveLogs(logsObj) {
  // logsObj is { 'yyyy-MM-dd': { ...logData } }
  const entries = Object.entries(logsObj);
  for (const [date, data] of entries) {
    await putItem(STORES.LOGS, { date, ...data });
  }
}

export async function saveLog(dateStr, data) {
  await putItem(STORES.LOGS, { date: dateStr, ...data });
}

export async function loadLogs() {
  const rows = await getAllItems(STORES.LOGS);
  const obj = {};
  for (const row of rows) {
    const { date, ...rest } = row;
    obj[date] = { date, ...rest };
  }
  return obj;
}

// User
export async function saveUser(userData) {
  await putItem(STORES.USER, { id: 'profile', ...userData });
}

export async function loadUser() {
  const row = await getItem(STORES.USER, 'profile');
  if (!row) return null;
  const { id, ...rest } = row;
  return rest;
}

export async function clearUser() {
  await deleteItem(STORES.USER, 'profile');
}

// Categories
export async function saveCategories(cats) {
  await putItem(STORES.CATEGORIES, { id: 'cats', list: cats });
}

export async function loadCategories() {
  const row = await getItem(STORES.CATEGORIES, 'cats');
  return row?.list ?? [];
}

// Current book
export async function saveCurrentBook(book) {
  await putItem(STORES.BOOK, { id: 'book', ...book });
}

export async function loadCurrentBook() {
  const row = await getItem(STORES.BOOK, 'book');
  if (!row) return null;
  const { id, ...rest } = row;
  return rest;
}

// Archives
export async function saveArchives(books) {
  await clearStore(STORES.ARCHIVES);
  for (const b of books) {
    await putItem(STORES.ARCHIVES, b);
  }
}

export async function loadArchives() {
  return getAllItems(STORES.ARCHIVES);
}

// ── Sync Queue ───────────────────────────────────────────────────

export async function enqueueSync(action) {
  // action: { type, url, method, body, timestamp }
  await putItem(STORES.SYNC_QUEUE, {
    ...action,
    timestamp: Date.now()
  });
}

export async function dequeueSyncAll() {
  const items = await getAllItems(STORES.SYNC_QUEUE);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function removeSyncItem(id) {
  await deleteItem(STORES.SYNC_QUEUE, id);
}

export async function clearSyncQueue() {
  await clearStore(STORES.SYNC_QUEUE);
}

// ── Notes ────────────────────────────────────────────────────────

export async function saveNote(note) {
  // note must have _id, date, content, createdAt, updatedAt
  await putItem(STORES.NOTES, note);
}

export async function loadAllNotes() {
  return getAllItems(STORES.NOTES);
}

export async function loadNotesByDate(dateStr) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORES.NOTES, 'readonly');
    const index = tx.objectStore(STORES.NOTES).index('date');
    const req   = index.getAll(dateStr);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteNote(id) {
  await deleteItem(STORES.NOTES, id);
}

export async function replaceAllNotes(notes) {
  await clearStore(STORES.NOTES);
  for (const note of notes) await putItem(STORES.NOTES, note);
}

// ── Full wipe (logout) ──────────────────────────────────────────

export async function clearAllOfflineData() {
  await clearStore(STORES.LOGS);
  await clearStore(STORES.USER);
  await clearStore(STORES.CATEGORIES);
  await clearStore(STORES.BOOK);
  await clearStore(STORES.ARCHIVES);
  await clearStore(STORES.SYNC_QUEUE);
  await clearStore(STORES.NOTES);
}
