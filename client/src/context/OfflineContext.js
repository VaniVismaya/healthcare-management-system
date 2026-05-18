import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { OFFLINE_QUEUE_EVENT, getQueuedRequestCount } from '../utils/offline';
import { syncOfflineRequests } from '../utils/api';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getQueuedRequestCount());
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(() => {
    setPendingCount(getQueuedRequestCount());
  }, []);

  const syncNow = useCallback(async ({ silent = false } = {}) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (syncing) return;

    setSyncing(true);
    try {
      const result = await syncOfflineRequests();
      refreshPendingCount();
      if (!silent && result.synced > 0) {
        toast.success(`${result.synced} offline change${result.synced > 1 ? 's' : ''} synced`);
      }
      if (!silent && result.failed > 0 && result.remaining > 0) {
        toast.error(`${result.remaining} offline change${result.remaining > 1 ? 's are' : ' is'} still waiting to sync`);
      }
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingCount, syncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
      syncNow({ silent: false });
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = () => refreshPendingCount();
    const handleAuthChanged = () => {
      refreshPendingCount();
      if (navigator.onLine) syncNow({ silent: true });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueUpdate);
    window.addEventListener('medicare-auth-changed', handleAuthChanged);

    const timer = window.setInterval(() => {
      refreshPendingCount();
      if (navigator.onLine && getQueuedRequestCount() > 0) {
        syncNow({ silent: true });
      }
    }, 20000);

    if (navigator.onLine && getQueuedRequestCount() > 0) {
      syncNow({ silent: true });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueUpdate);
      window.removeEventListener('medicare-auth-changed', handleAuthChanged);
      window.clearInterval(timer);
    };
  }, [refreshPendingCount, syncNow]);

  const value = useMemo(() => ({
    isOnline,
    pendingCount,
    syncing,
    syncNow,
  }), [isOnline, pendingCount, syncing, syncNow]);

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
};

