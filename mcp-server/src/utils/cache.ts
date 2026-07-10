interface CacheEntry<T> {
  value: T;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function cacheSet<T>(key: string, value: T, ttlSeconds: number = 300): void {
  const expiry = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(key, { value, expiry });
}

export function cacheGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiry) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function cacheClear(): void {
  memoryCache.clear();
}
