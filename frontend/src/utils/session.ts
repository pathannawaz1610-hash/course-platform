import { buildApiUrl } from '@/lib/api';
import type { StoredSession } from '@/types/session';
import { refreshToken as refreshTokenAction } from '@/lib/binding/actions/authActions';

const STORAGE_KEY = 'session';
const USER_KEY = 'user';
const AUTH_FLAG_KEY = 'isAuthenticated';
const REFRESH_BUFFER_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 15_000;

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const readStoredSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredSession;
  } catch (error) {
    console.error('Failed to read stored session', error);
    return null;
  }
};

export const writeStoredSession = (session: StoredSession): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.setItem(AUTH_FLAG_KEY, 'false');
};

export const shouldRefreshAccessToken = (session: StoredSession, bufferMs = REFRESH_BUFFER_MS): boolean => {
  const expiry = parseTimestamp(session.accessTokenExpiresAt);
  if (!expiry) {
    return false;
  }

  return expiry - Date.now() <= bufferMs;
};

export const isRefreshTokenExpired = (session: StoredSession): boolean => {
  const expiry = parseTimestamp(session.refreshTokenExpiresAt);
  if (!expiry) {
    return false;
  }

  return expiry <= Date.now();
};

export const requestSessionRefresh = async (session: StoredSession): Promise<StoredSession | null> => {
  if (isRefreshTokenExpired(session)) {
    return null;
  }

  try {
    // ✅ UPDATED: Use authActions instead of direct fetch
    const data = await refreshTokenAction(session.refreshToken);
    const refreshed = data.session;

    if (!refreshed?.accessToken || !refreshed?.accessTokenExpiresAt) {
      return null;
    }

    const nextSession: StoredSession = {
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      refreshTokenExpiresAt: refreshed.refreshTokenExpiresAt ?? session.refreshTokenExpiresAt,
      sessionId: refreshed.sessionId ?? session.sessionId,
      role: session.role,
      userId: session.userId,
      email: session.email,
      fullName: session.fullName
    };

    writeStoredSession(nextSession);
    return nextSession;
  } catch (error) {
    console.error('Failed to refresh session', error);
    return null;
  }
};

export const ensureSessionFresh = async (
  session: StoredSession | null,
  options?: { notifyOnFailure?: boolean },
): Promise<StoredSession | null> => {
  if (!session) {
    return null;
  }

  if (!shouldRefreshAccessToken(session)) {
    return session;
  }

  const refreshed = await requestSessionRefresh(session);
  if (!refreshed) {
    clearStoredSession();
    if (options?.notifyOnFailure !== false) {
      notifyListeners(null);
      stopHeartbeat();
    }
  }
  return refreshed;
};

export const logoutAndRedirect = (target = '/'): void => {
  clearStoredSession();
  notifyListeners(null);
  stopHeartbeat();
  if (typeof window !== 'undefined' && window.location.pathname !== target) {
    window.location.assign(target);
  }
};

export const computeRefreshDelay = (session: StoredSession, bufferMs = REFRESH_BUFFER_MS): number | null => {
  const accessExpiry = parseTimestamp(session.accessTokenExpiresAt);
  const refreshExpiry = parseTimestamp(session.refreshTokenExpiresAt);

  if (!accessExpiry || !refreshExpiry) {
    return null;
  }

  const now = Date.now();
  const refreshDeadline = refreshExpiry - now - bufferMs;
  if (refreshDeadline <= 0) {
    return null;
  }

  const accessDeadline = accessExpiry - now - bufferMs;
  if (accessDeadline <= 0) {
    return 0;
  }

  return Math.max(Math.min(accessDeadline, refreshDeadline), MIN_REFRESH_DELAY_MS);
};

export const SESSION_REFRESH_BUFFER_MS = REFRESH_BUFFER_MS;

type SessionListener = (session: StoredSession | null) => void;

const sessionListeners = new Set<SessionListener>();
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatActive = false;

const notifyListeners = (session: StoredSession | null) => {
  sessionListeners.forEach((listener) => {
    try {
      listener(session);
    } catch (error) {
      console.error('Session listener threw', error);
    }
  });
};

const stopHeartbeat = () => {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
  heartbeatActive = false;
};

const heartbeatTick = async () => {
  heartbeatTimer = null;

  const stored = readStoredSession();
  if (!stored) {
    clearStoredSession();
    notifyListeners(null);
    stopHeartbeat();
    return;
  }

  const refreshed = await ensureSessionFresh(stored, { notifyOnFailure: false });
  if (!refreshed) {
    clearStoredSession();
    notifyListeners(null);
    stopHeartbeat();
    return;
  }

  notifyListeners(refreshed);
  scheduleHeartbeat(refreshed);
};

const scheduleHeartbeat = (session: StoredSession) => {
  const delay = computeRefreshDelay(session);
  if (delay === null) {
    stopHeartbeat();
    return;
  }

  heartbeatTimer = setTimeout(() => {
    void heartbeatTick();
  }, Math.max(delay, 0));
};

const bootstrapHeartbeat = async () => {
  if (heartbeatActive) {
    return;
  }

  heartbeatActive = true;

  const stored = readStoredSession();
  if (!stored) {
    notifyListeners(null);
    stopHeartbeat();
    return;
  }

  const activeSession = await ensureSessionFresh(stored, { notifyOnFailure: false });
  if (!activeSession) {
    clearStoredSession();
    notifyListeners(null);
    stopHeartbeat();
    return;
  }

  notifyListeners(activeSession);
  scheduleHeartbeat(activeSession);
};

export const resetSessionHeartbeat = (): void => {
  stopHeartbeat();
  if (sessionListeners.size > 0) {
    void bootstrapHeartbeat();
  }
};

export const subscribeToSession = (listener: SessionListener): (() => void) => {
  sessionListeners.add(listener);
  listener(readStoredSession());

  if (sessionListeners.size === 1) {
    void bootstrapHeartbeat();
  }

  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) {
      stopHeartbeat();
    }
  };
};
