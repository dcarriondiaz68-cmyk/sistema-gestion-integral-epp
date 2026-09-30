const DB_NAME = 'gestion-epp-offline';
const CACHE_STORE_NAME = 'data_cache';

interface CacheEntry<T> {
  key: string;
  data: T;
  updated_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  const db = await openDB();
  const entry: CacheEntry<T> = { key, data, updated_at: new Date().toISOString() };
  await promisify(db.transaction(CACHE_STORE_NAME, 'readwrite').objectStore(CACHE_STORE_NAME).put(entry));
  db.close();
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  const result = await promisify(db.transaction(CACHE_STORE_NAME, 'readonly').objectStore(CACHE_STORE_NAME).get(key) as IDBRequest<CacheEntry<T> | undefined>);
  db.close();
  return result?.data ?? null;
}

export async function getCachedDataWithMeta<T>(key: string): Promise<{ data: T; updated_at: string } | null> {
  const db = await openDB();
  const result = await promisify(db.transaction(CACHE_STORE_NAME, 'readonly').objectStore(CACHE_STORE_NAME).get(key) as IDBRequest<CacheEntry<T> | undefined>);
  db.close();
  if (!result) return null;
  return { data: result.data, updated_at: result.updated_at };
}

export async function clearCachedData(key: string): Promise<void> {
  const db = await openDB();
  await promisify(db.transaction(CACHE_STORE_NAME, 'readwrite').objectStore(CACHE_STORE_NAME).delete(key));
  db.close();
}

export async function clearAllCache(): Promise<void> {
  const db = await openDB();
  await promisify(db.transaction(CACHE_STORE_NAME, 'readwrite').objectStore(CACHE_STORE_NAME).clear());
  db.close();
}

/**
 * Fetches data online, caching the result on success.
 * If the online fetch fails (e.g. offline), returns the last cached value.
 * If no cache exists either, throws the original error.
 */
export async function fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    const data = await fetcher();
    await setCachedData(cacheKey, data);
    return data;
  } catch (err) {
    const cached = await getCachedData<T>(cacheKey);
    if (cached !== null) return cached;
    throw err;
  }
}
