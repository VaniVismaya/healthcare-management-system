import React from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useOffline } from '../../context/OfflineContext';

const OfflineStatusBar = () => {
  const { isOnline, pendingCount, syncing, syncNow } = useOffline();

  if (isOnline && pendingCount === 0 && !syncing) return null;

  return (
    <div className={`offline-status-bar ${isOnline ? 'is-online' : 'is-offline'}`}>
      <div className="offline-status-copy">
        {isOnline ? <Wifi size={15} /> : <WifiOff size={15} />}
        <span>
          {!isOnline && 'You are offline. Saved pages will still open, and new supported changes will queue locally.'}
          {isOnline && syncing && 'Syncing offline changes...'}
          {isOnline && !syncing && pendingCount > 0 && `${pendingCount} offline change${pendingCount > 1 ? 's are' : ' is'} waiting to sync.`}
        </span>
      </div>
      {isOnline && pendingCount > 0 && (
        <button className="btn btn-sm btn-outline" type="button" onClick={() => syncNow()}>
          <RefreshCw size={14} />
          Sync Now
        </button>
      )}
    </div>
  );
};

export default OfflineStatusBar;

