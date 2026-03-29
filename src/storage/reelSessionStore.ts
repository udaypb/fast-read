import type { Reel } from '../api/types';

const STORAGE_KEY = 'read-fast:reel-sessions:v1';
const MAX_SESSION_STORAGE_MB = 4;

export type StoredReelSession = {
  docId: string;
  reels: Reel[];
  activeReelId: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoreState = {
  version: 1;
  hasVisited: boolean;
  sessions: StoredReelSession[];
};

const DEFAULT_STATE: StoreState = {
  version: 1,
  hasVisited: false,
  sessions: []
};

function safeParse(raw: string | null): StoreState {
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      version: 1,
      hasVisited: Boolean(parsed.hasVisited),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions as StoredReelSession[] : []
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function getByteLength(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return JSON.stringify(value).length;
  }
}

function loadState(): StoreState {
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
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

function enforceStorageCap(state: StoreState): void {
  const maxBytes = MAX_SESSION_STORAGE_MB * 1024 * 1024;

  state.sessions.sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return aTime - bTime;
  });

  while (state.sessions.length > 0 && getByteLength(state) > maxBytes) {
    state.sessions.shift();
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

  enforceStorageCap(state);
  persistState(state);
}

export function updateSessionActiveReel(docId: string, activeReelId: string | null): void {
  const state = loadState();
  const session = state.sessions.find((item) => item.docId === docId);
  if (!session) return;

  session.activeReelId = activeReelId;
  session.updatedAt = new Date().toISOString();
  enforceStorageCap(state);
  persistState(state);
}

export function getLatestSession(): StoredReelSession | null {
  const state = loadState();
  if (state.sessions.length === 0) return null;

  const sorted = [...state.sessions].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  });

  return sorted[0] ?? null;
}
