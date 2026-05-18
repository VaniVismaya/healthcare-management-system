const canUseStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const loadDraft = (key, fallback = null) => {
  if (!canUseStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const saveDraft = (key, value) => {
  if (!canUseStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({
      ...value,
      savedAt: Date.now(),
    }));
  } catch {
    // Ignore storage issues to keep forms usable.
  }
};

export const clearDraft = (key) => {
  if (!canUseStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage issues.
  }
};

