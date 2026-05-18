const QUEUE_KEY = 'medicare_offline_queue_v1';
const CACHE_KEY = 'medicare_offline_cache_v1';
const MAX_CACHE_ENTRIES = 60;

export const OFFLINE_QUEUE_EVENT = 'medicare-offline-queue-updated';

const SAFE_WRITE_DENY_LIST = [
  /^\/auth\//,
  /^\/payments\//,
  /^\/upload\//,
  /^\/appointments\/book$/,
  /^\/appointments\/walk-in$/,
  /^\/appointments\/qr\//,
];

const isBrowser = typeof window !== 'undefined';

const readJson = (key, fallback) => {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues and keep app usable.
  }
};

const emitQueueUpdate = () => {
  if (isBrowser) window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
};

const resolvePath = (url = '') => {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
};

const buildCacheKey = (config = {}) => {
  const url = `${config.baseURL || ''}${config.url || ''}`;
  const params = config.params || {};
  const search = new URLSearchParams(params).toString();
  return `${url}${search ? `?${search}` : ''}`;
};

const trimCache = (cache) => {
  const entries = Object.entries(cache)
    .sort(([, a], [, b]) => (b.cachedAt || 0) - (a.cachedAt || 0))
    .slice(0, MAX_CACHE_ENTRIES);
  return Object.fromEntries(entries);
};

export const getQueuedRequestCount = () => readJson(QUEUE_KEY, []).length;

export const canQueueOfflineRequest = (config = {}) => {
  const method = (config.method || 'get').toLowerCase();
  const path = resolvePath(config.url);
  const contentType = String(config.headers?.['Content-Type'] || config.headers?.['content-type'] || '').toLowerCase();

  if (!['post', 'put', 'patch', 'delete'].includes(method)) return false;
  if (config.offlineMeta?.skipQueue || config.offlineMeta?.disableQueue) return false;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) return false;
  if (contentType.includes('multipart/form-data')) return false;
  if (SAFE_WRITE_DENY_LIST.some((pattern) => pattern.test(path))) return false;

  return true;
};

export const queueOfflineRequest = (config = {}) => {
  const queue = readJson(QUEUE_KEY, []);
  const item = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: Date.now(),
    method: (config.method || 'post').toLowerCase(),
    baseURL: config.baseURL || '',
    url: config.url || '',
    params: config.params || null,
    data: config.data ?? null,
    headers: {
      'Content-Type': config.headers?.['Content-Type'] || config.headers?.['content-type'] || 'application/json',
    },
  };

  queue.push(item);
  writeJson(QUEUE_KEY, queue);
  emitQueueUpdate();
  return item;
};

export const cacheGetResponse = (config = {}, response) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' || config.offlineMeta?.skipCache) return;

  const cache = readJson(CACHE_KEY, {});
  cache[buildCacheKey(config)] = {
    cachedAt: Date.now(),
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data,
  };
  writeJson(CACHE_KEY, trimCache(cache));
};

export const getCachedResponse = (config = {}) => {
  const cache = readJson(CACHE_KEY, {});
  const cached = cache[buildCacheKey(config)];
  if (!cached) return null;

  return {
    data: {
      ...cached.data,
      _offline: true,
      _cachedAt: cached.cachedAt,
    },
    status: cached.status || 200,
    statusText: cached.statusText || 'OK',
    headers: cached.headers || {},
    config,
    request: { fromCache: true },
  };
};

export const flushOfflineQueue = async (apiInstance) => {
  if (!isBrowser || !navigator.onLine) return { synced: 0, failed: 0, remaining: getQueuedRequestCount() };

  const queue = readJson(QUEUE_KEY, []);
  if (!queue.length) return { synced: 0, failed: 0, remaining: 0 };

  const remaining = [];
  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await apiInstance.request({
        method: item.method,
        baseURL: item.baseURL,
        url: item.url,
        params: item.params || undefined,
        data: item.data,
        headers: item.headers,
        offlineMeta: { skipQueue: true },
      });
      synced += 1;
    } catch (error) {
      failed += 1;
      if (!error.response || error.response.status === 401 || error.response.status >= 500) {
        remaining.push(item);
      }
    }
  }

  writeJson(QUEUE_KEY, remaining);
  emitQueueUpdate();
  return { synced, failed, remaining: remaining.length };
};

