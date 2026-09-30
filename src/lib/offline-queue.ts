import type { SyncOperation, SyncOperationStatus } from '@/types/sync.types';

const DB_NAME = 'gestion-epp-offline';
const STORE_NAME = 'sync_queue';
export const CACHE_STORE_NAME = 'data_cache';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
      }
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueue(operation: SyncOperation): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'readwrite').add(operation));
  db.close();
}

export async function getAll(): Promise<SyncOperation[]> {
  const db = await openDB();
  const result = await promisify(tx(db, 'readonly').getAll());
  db.close();
  return (result as SyncOperation[]).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function getPending(): Promise<SyncOperation[]> {
  const all = await getAll();
  return all.filter((op) => op.status === 'pendiente' || op.status === 'error' || op.status === 'sincronizando');
}

export async function updateStatus(
  id: string,
  status: SyncOperationStatus,
  message?: string
): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'readwrite');
  const existing = await promisify(store.get(id) as IDBRequest<SyncOperation>);
  if (existing) {
    existing.status = status;
    if (message !== undefined) existing.message = message;
    if (status === 'sincronizando' || status === 'error') {
      existing.attempts += 1;
    }
    await promisify(store.put(existing));
  }
  db.close();
}

export async function removeOperation(id: string): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'readwrite').delete(id));
  db.close();
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  await promisify(tx(db, 'readwrite').clear());
  db.close();
}

export async function purgeSynchronized(): Promise<void> {
  const db = await openDB();
  const store = tx(db, 'readwrite');
  const all = await promisify(store.getAll() as IDBRequest<SyncOperation[]>);
  const toDelete = (all ?? []).filter((op) => op.status === 'sincronizado');
  for (const op of toDelete) {
    await promisify(store.delete(op.id));
  }
  db.close();
}
