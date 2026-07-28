import type { Reel } from '../api/types';

const STORAGE_KEY = 'read-fast:reel-sessions:v2';
const LEGACY_STORAGE_KEY = 'read-fast:reel-sessions:v1';

export type StoredReelSession = {
  docId: string;
  label: string;
  reels: Reel[];
  activeReelId: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreState = {
  version: 2;
  hasVisited: boolean;
  sessions: StoredReelSession[];
};

const DEFAULT_STATE: StoreState = {
  version: 2,
  hasVisited: false,
  sessions: []
};

function normalizeSession(session: Partial<StoredReelSession>, index: number): StoredReelSession | null {
  if (!session.docId || !Array.isArray(session.reels)) {
    return null;
  }

  const fallbackLabel = session.reels[0]?.title?.trim() || `Upload ${index + 1}`;
  const createdAt = session.createdAt || new Date().toISOString();
  const updatedAt = session.updatedAt || createdAt;

  return {
    docId: session.docId,
    label: typeof session.label === 'string' && session.label.trim() ? session.label : fallbackLabel,
    reels: session.reels,
    activeReelId: typeof session.activeReelId === 'string' ? session.activeReelId : null,
    createdAt,
    updatedAt
  };
}

function safeParse(raw: string | null): StoreState {
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      version: 2,
      hasVisited: Boolean(parsed.hasVisited),
      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions
            .map((session, index) => normalizeSession(session as Partial<StoredReelSession>, index))
            .filter((session): session is StoredReelSession => Boolean(session))
        : []
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function loadState(): StoreState {
  try {
    const localState = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (localState.sessions.length > 0 || localState.hasVisited) {
      return localState;
    }

    const sessionState = safeParse(window.sessionStorage.getItem(STORAGE_KEY));
    if (sessionState.sessions.length > 0 || sessionState.hasVisited) {
      persistState(sessionState);
      return sessionState;
    }

    const legacyState = safeParse(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (legacyState.sessions.length > 0 || legacyState.hasVisited) {
      persistState(legacyState);
      return legacyState;
    }

    return sessionState;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function persistState(state: StoreState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // no-op for quota/private mode issues
  }
}

export function markVisitedApp(): void {
  const state = loadState();
  state.hasVisited = true;
  persistState(state);
}

export function hasVisitedApp(): boolean {
  return loadState().hasVisited;
}

export function saveOrUpdateSession(session: StoredReelSession): void {
  const state = loadState();
  const existingIndex = state.sessions.findIndex((item) => item.docId === session.docId);

  if (existingIndex >= 0) {
    state.sessions[existingIndex] = session;
  } else {
    state.sessions.push(session);
  }

  persistState(state);
}

export function updateSessionActiveReel(docId: string, activeReelId: string | null): void {
  const state = loadState();
  const session = state.sessions.find((item) => item.docId === docId);
  if (!session) return;

  session.activeReelId = activeReelId;
  session.updatedAt = new Date().toISOString();
  persistState(state);
}

export function deleteStoredSession(docId: string): void {
  const state = loadState();
  const nextSessions = state.sessions.filter((item) => item.docId !== docId);

  if (nextSessions.length === state.sessions.length) {
    return;
  }

  state.sessions = nextSessions;
  persistState(state);
}

export function clearStoredSessions(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op for private mode/storage access issues
  }
}

export function getLatestSession(): StoredReelSession | null {
  return getStoredSessions()[0] ?? null;
}

export function getStoredSessions(): StoredReelSession[] {
  const state = loadState();
  return [...state.sessions].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });
}
