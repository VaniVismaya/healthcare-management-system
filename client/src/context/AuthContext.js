import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);
const USER_CACHE_KEY = 'medicare_user';
const USER_CACHE_TS_KEY = 'medicare_user_checked_at';
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCachedUser = (user) => {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      localStorage.setItem(USER_CACHE_TS_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
      localStorage.removeItem(USER_CACHE_TS_KEY);
    }
  } catch {
    // Keep auth usable even if storage is unavailable.
  }
};

const shouldRefreshUser = () => {
  try {
    const lastChecked = Number(localStorage.getItem(USER_CACHE_TS_KEY) || 0);
    return !lastChecked || (Date.now() - lastChecked) > USER_CACHE_TTL_MS;
  } catch {
    return true;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const cachedUser = readCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }
      if (cachedUser && !shouldRefreshUser()) {
        return;
      }
      authAPI.getMe()
        .then(({ data }) => {
          setUser(data.user);
          saveCachedUser(data.user);
        })
        .catch(() => {
          localStorage.clear();
          saveCachedUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      saveCachedUser(null);
      setLoading(false);
    }
  }, []);

  const login = (userData, tokens) => {
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    setUser(userData);
    saveCachedUser(userData);
    window.dispatchEvent(new Event('medicare-auth-changed'));
  };

  const logout = () => {
    localStorage.clear();
    setUser(null);
    saveCachedUser(null);
    window.dispatchEvent(new Event('medicare-auth-changed'));
    toast.success('Logged out successfully');
  };

  const updateUser = (updates) => setUser(prev => {
    const next = { ...prev, ...updates };
    saveCachedUser(next);
    return next;
  });

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
