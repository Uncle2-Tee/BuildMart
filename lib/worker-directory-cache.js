const cacheState = globalThis.__buildmartWorkerDirectoryCache ?? {
  data: null,
  expiresAt: 0,
  request: null,
};

globalThis.__buildmartWorkerDirectoryCache = cacheState;

export function getWorkerDirectoryCache() {
  return cacheState;
}

export function clearWorkerDirectoryCache() {
  cacheState.data = null;
  cacheState.expiresAt = 0;
}
