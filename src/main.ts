import './styles/main.css';

import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import { createDocFromFile, createDocFromText, getDocStatus, getReelPage, streamReels } from './api/client';
import type { Reel, ReelPage } from './api/types';
import type { Frame } from './reader/types';
import {
  deleteStoredSession,
  getStoredSessions,
  markVisitedApp,
  saveOrUpdateSession,
  updateSessionActiveReel,
  type StoredReelSession
} from './storage/reelSessionStore';
import { Background } from './ui/Background';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ImportDialog } from './ui/ImportDialog';
import { ReelRail } from './ui/ReelRail';
import { SettingsPanel, type ReelGroup } from './ui/SettingsPanel';
import { ReelsPlayer, DisplayMode } from './ui/ReelsPlayer';
import { SettingsButton } from './ui/SettingsButton';
import { backgroundCatalog, getBackgroundDefinition } from './ui/backgrounds/catalog';

const SAMPLE_TEXT =
  'Read Fast is a minimalist speed reading demo. It keeps the words steady, inside two calm guide bars, so your eyes stay centered. Use the controls to play, pause, or adjust the speed. Tap space to start, then arrow keys to jump or change pace.';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App container not found');
}
document.body.classList.add('mode-portrait');

const background = new Background(app);
background.start();
const confirmDialog = new ConfirmDialog();

const DEFAULT_WPM = 250;
const DEFAULT_CHUNK_SIZE = 1;
const REEL_PAGE_LIMIT = 5;
const REEL_TRANSITION_PAUSE_MS = 1000;

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function buildSessionLabel(kind: 'text' | 'file', sequence: number, fileName?: string): string {
  if (kind === 'file') {
    const trimmedName = fileName ? stripFileExtension(fileName) : '';
    return trimmedName || `PDF ${sequence}`;
  }

  return `Text ${sequence}`;
}

function setReadingTextTone(tone?: 'light' | 'dark'): void {
  if (tone === 'dark' || tone === 'light') {
    document.body.dataset.textTone = tone;
    return;
  }

  document.body.dataset.textTone = 'light';
}

function applyBackgroundAndTone(styleId: string, options?: { allowManualTone?: boolean }): void {
  const definition = getBackgroundDefinition(styleId);
  const tone = definition?.textTone;
  if (options?.allowManualTone !== false) {
    setReadingTextTone(tone);
  }
  void background.setStyle(styleId);
}

let activeText = SAMPLE_TEXT;
let currentChunkSize = DEFAULT_CHUNK_SIZE;
let activeSessionCreatedAt = new Date().toISOString();
const sessionCache = new Map<string, StoredReelSession>();

const tokens = tokenize(SAMPLE_TEXT);
const frames = groupTokens(tokens, DEFAULT_CHUNK_SIZE);

const importDialog = new ImportDialog(app);
const reelRail = new ReelRail(app);
reelRail.hide();
reelRail.setStatus('Upload a PDF or paste text to load reels.');
reelRail.setLoading(false);

const reelsPlayer = new ReelsPlayer(app);
const settingsPanel = new SettingsPanel(reelsPlayer.getContentElement(), DEFAULT_WPM, DEFAULT_CHUNK_SIZE);
const settingsButton = new SettingsButton(reelsPlayer.getContentElement());
let stopReelStream: (() => void) | null = null;
let stopReelPoll: (() => void) | null = null;
reelsPlayer.setWpm(DEFAULT_WPM);

// Bind settings button to toggle settings panel
settingsButton.bind(() => settingsPanel.toggle());

// Bind settings panel handlers
settingsPanel.bind({
  onStyleChange: (style: string, specificId?: string) => {
    activeStyle = style;

    if (specificId) {
      manualBackgroundId = specificId;
      applyBackgroundAndTone(specificId);
      reelsPlayer.setManualBackground(specificId);
      return;
    }

    // Changing category clears specific selection
    manualBackgroundId = null;
    reelsPlayer.setManualBackground(null);

    // Default behaviors when switching category only
    if (activeStyle === 'cartoon') {
      const cartoons = ['stickman', 'blobs', 'rain'];
      const randomId = cartoons[Math.floor(Math.random() * cartoons.length)];
      applyBackgroundAndTone(randomId);
    } else if (activeStyle === 'calming') {
      const currentReelId = reelState.activeReelId;
      applyBackgroundAndTone('net');
      const reel = reelState.currentPage?.reels.find(r => r.reelId === currentReelId);
      if (reel) {
        applyBackgroundAndTone(reel.backgroundId);
      }
    } else if (activeStyle === 'real') {
      console.log('Real mode selected (placeholder)');
    } else if (activeStyle === 'satisfying' || activeStyle === 'subway' || activeStyle === 'temple' || activeStyle === 'minecraft') {
      // Auto-select first item if exists
      const item = backgroundCatalog.find(b => b.category === activeStyle);
      if (item) {
        applyBackgroundAndTone(item.id);
      }
    }
  },
  onPlayPause: () => {
    togglePlaybackFromStartIfEnded();
    reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
  },
  onRewind: () => reader.seek(-3),
  onForward: () => reader.seek(3),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onChunkSizeChange: (chunkSize) => applyChunkSize(chunkSize),
  onReelSelect: (reel) => {
    selectReel(reel, true);
  },
  onReelDelete: (reel) => {
    void deleteReelFromSession(reel);
  }
});

reelsPlayer.bind({
  onPlayPause: () => {
    togglePlaybackFromStartIfEnded();
    reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
  },
  onSeek: (delta) => reader.seek(delta),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onPreviewExpandChange: (expanded) => {
    if (expanded) {
      clearReelAutoplayTimeout();
      reader.pause();
      settingsPanel.close();
    }
  },
  onDelete: () => {
    void deleteActiveReelGroup();
  },
  onStatusClick: () => {
    settingsPanel.open();
  },
  onActiveReelChange: (reelId: string) => {
    // When the user scrolls manually, sync the rest of the app
    const reel = reelState.currentPage?.reels.find(r => r.reelId === reelId);
    if (reel) {
      selectReel(reel, false, false);
    }
  }
});

let activeStyle: string = 'calming';
let manualBackgroundId: string | null = null;

function applyChunkSize(chunkSize: number): void {
  currentChunkSize = Math.max(1, Math.min(3, chunkSize));
  settingsPanel.setChunkSize(currentChunkSize);

  const wasPlaying = reader.getState().isPlaying;

  if (reelState.activeReelId) {
    const activeReel =
      reelState.currentPage?.reels.find((reel) => reel.reelId === reelState.activeReelId) ?? null;

    if (activeReel) {
      const reelFrames = buildReelFrames(activeReel, currentChunkSize);
      reader.setFrames(reelFrames, { preservePosition: false });
      reelsPlayer.setFrame(reelFrames[0] ?? null);
      reelsPlayer.setProgress(0, reelFrames.length);
      if (wasPlaying) {
        reader.play();
      }
      return;
    }
  }

  const nextFrames = groupTokens(tokenize(activeText), currentChunkSize);
  reader.setFrames(nextFrames, { preservePosition: false });
  reelsPlayer.setFrame(nextFrames[0] ?? null);
  reelsPlayer.setProgress(0, nextFrames.length);
  if (wasPlaying) {
    reader.play();
  }
}

const reader = new Reader({
  frames,
  wpm: DEFAULT_WPM,
  onFrame: (frame) => {
    reelsPlayer.setFrame(frame);
  },
  onStateChange: (state) => {
    reelsPlayer.setPlaying(state.isPlaying);
    reelsPlayer.setProgress(state.currentIndex, state.totalFrames);
    settingsPanel.setPlaying(state.isPlaying);
    settingsPanel.setWpm(state.wpm);
    reelsPlayer.setWpm(state.wpm);
  }
});

reader.setFrames(frames, { preservePosition: false });

const storedSessions = getStoredSessions();
storedSessions.forEach((session) => sessionCache.set(session.docId, session));
void runIntroSequence(storedSessions);

function getOrderedSessions(): StoredReelSession[] {
  return [...sessionCache.values()].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return aTime - bTime;
  });
}

function getLatestStoredSession(): StoredReelSession | null {
  return [...sessionCache.values()].sort((a, b) => {
    const aTime = new Date(a.updatedAt).getTime();
    const bTime = new Date(b.updatedAt).getTime();
    return bTime - aTime;
  })[0] ?? null;
}

function syncDeleteAvailability(): void {
  reelsPlayer.setDeleteEnabled(Boolean(reelState.docId));
}

function syncRailFromSessions(options?: { currentUploadId?: string | null; activeReelId?: string | null }): void {
  const sessions = getOrderedSessions();
  const activeDocId = options?.currentUploadId ?? reelState.docId;
  const activeReelId = options?.activeReelId ?? reelState.activeReelId;

  if (sessions.length === 0) {
    reelRail.setUploads([]);
    settingsPanel.setGroups([], null);
    return;
  }

  reelRail.show();
  reelRail.setUploads(
    sessions.map((session) => ({
      uploadId: session.docId,
      label: session.label,
      reels: session.reels
    })),
    {
      currentUploadId: activeDocId,
      activeReelId: activeReelId
    }
  );

  // Push all groups to settings panel so the reels section is always current
  const groups: ReelGroup[] = sessions.map((session) => ({
    docId: session.docId,
    label: session.label,
    reels: session.reels,
    isActive: session.docId === activeDocId
  }));
  settingsPanel.setGroups(groups, activeReelId);
}

function togglePlaybackFromStartIfEnded(): void {
  const state = reader.getState();
  const isAtEnd = state.totalFrames > 0 && state.currentIndex >= state.totalFrames - 1;

  if (!state.isPlaying && isAtEnd) {
    reader.seek(-state.currentIndex);
    reader.play();
    return;
  }

  reader.toggle();
}

function activatePortraitMode(): void {
  reelsPlayer.setMode(DisplayMode.Portrait);
  document.body.classList.add('mode-portrait');
  document.body.classList.remove('mode-standard');
  settingsPanel.close();

  const bgEl = document.querySelector('.bg-layer');
  if (bgEl instanceof HTMLElement) {
    reelsPlayer.getContentElement().insertBefore(bgEl, reelsPlayer.getContentElement().firstChild);
  }
}

function restoreSession(session: StoredReelSession): void {
  const reels = session.reels ?? [];
  sessionCache.set(session.docId, session);
  activeSessionCreatedAt = session.createdAt;
  resetReelState(session.docId);
  syncDeleteAvailability();
  reelState.documentCount = Math.max(reelState.documentCount, sessionCache.size);

  reelRail.show();
  syncRailFromSessions({
    currentUploadId: session.docId,
    activeReelId: session.activeReelId
  });

  if (reels.length === 0) {
    reelsPlayer.clearReels();
    reelsPlayer.updateStatus(0, true);
    reelsPlayer.setLoading(false);
    reelRail.setLoading(false);
    importDialog.setMinimized(false);
    importDialog.setButtonText('Upload another PDF or text');
    showEmptyReel();
    return;
  }

  reelState.currentPage = {
    docId: session.docId,
    totalReels: reels.length,
    offset: 0,
    limit: reels.length,
    reels,
    prevOffset: null,
    nextOffset: null
  };

  reelsPlayer.clearReels();
  reels.forEach((reel) => reelsPlayer.addReel(reel));
  reelsPlayer.updateStatus(reels.length, true);
  reelsPlayer.setLoading(false);
  reelRail.setLoading(false);

  // Content exists — collapse the import button to a small persistent pill
  importDialog.setMinimized(true);
  importDialog.setButtonText('+ Add more');

  const active = reels.find((reel) => reel.reelId === session.activeReelId) ?? reels[0];
  if (active) {
    selectReel(active, false);
  }
}

async function runIntroSequence(sessions: StoredReelSession[]) {
  markVisitedApp();
  document.body.classList.add('intro-active');
  applyBackgroundAndTone('intro');

  const introTextWrapper = document.createElement('div');
  introTextWrapper.className = 'intro-text-wrapper';
  const introTextEl = document.createElement('div');
  introTextEl.className = 'intro-text';
  introTextWrapper.append(introTextEl);
  app!.append(introTextWrapper);

  const introPhrases = [
    'Get ready',
    'to discover',
    'your true',
    'reading speed',
    'with Read Fast'
  ];

  for (const phrase of introPhrases) {
    introTextEl.textContent = phrase;
    introTextEl.classList.add('intro-text--visible');
    await new Promise(r => setTimeout(r, 800));
    introTextEl.classList.remove('intro-text--visible');
    await new Promise(r => setTimeout(r, 200));
  }

  introTextEl.textContent = 'Read Fast';
  introTextEl.classList.add('intro-text--visible');
  await new Promise(r => setTimeout(r, 1000));

  // Trigger implode animation on the text wrapper for a dramatic exit
  introTextWrapper.classList.add('implode-active');
  await new Promise(r => setTimeout(r, 800));

  introTextWrapper.remove();
  document.body.classList.remove('intro-active');
  app!.classList.add('ui-entrance');

  activatePortraitMode();

  // Preserve original intro on every reload, then route to content if available.
  const latestSession = sessions[0] ?? null;
  if (latestSession && Array.isArray(latestSession.reels) && latestSession.reels.length > 0) {
    restoreSession(latestSession);
    return;
  }

  // New-user landing (also for returning users with no saved reels)
  showEmptyReel();
}

const reelState = {
  docId: '',
  activeReelId: null as string | null,
  currentReelIndex: -1,
  currentPage: null as ReelPage | null,
  documentCount: 0
};

reelState.documentCount = Math.max(reelState.documentCount, storedSessions.length);

const reelCache = new Map<number, ReelPage>();
const reelRequests = new Map<number, Promise<ReelPage>>();
let reelAutoplayTimeout: number | null = null;

reelRail.bind({
  onSelect: (reel) => {
    if (reel.docId !== reelState.docId) {
      const session = sessionCache.get(reel.docId);
      if (session) {
        restoreSession(session);
      }
    }
    selectReel(reel, true);
  },
  onUploadChange: (uploadId) => {
    if (reelState.docId === uploadId) {
      return;
    }

    const session = sessionCache.get(uploadId);
    if (session) {
      restoreSession(session);
    }
  },
  onRequestPage: (direction) => {
    const page = reelState.currentPage;
    if (!page) return;
    const target = direction === 'next' ? page.nextOffset : page.prevOffset;
    if (target === null || target === page.offset) return;
    void loadReelPage(target, direction === 'next' ? 'start' : 'end');
  }
});

importDialog.bind({
  onImportText: (text) => {
    void ingestText(text);
  },
  onImportFile: (file) => {
    void ingestFile(file);
  }
});

function closeReelStream(): void {
  if (stopReelStream) {
    stopReelStream();
    stopReelStream = null;
  }
  if (stopReelPoll) {
    stopReelPoll();
    stopReelPoll = null;
  }
}

function confirmDeletion(options: { title: string; message: string; confirmLabel?: string }): Promise<boolean> {
  return confirmDialog.open(options);
}

async function deleteActiveReelGroup(options?: { skipConfirm?: boolean }): Promise<void> {
  const docId = reelState.docId;
  if (!docId) {
    return;
  }

  if (!options?.skipConfirm) {
    const session = sessionCache.get(docId);
    const label = session?.label || 'this reel group';
    const confirmed = await confirmDeletion({
      title: 'Delete Reel Group?',
      message: `Remove ${label} and all reels in it from this session?`,
      confirmLabel: 'Delete group'
    });
    if (!confirmed) {
      return;
    }
  }

  closeReelStream();
  sessionCache.delete(docId);
  deleteStoredSession(docId);
  reelState.documentCount = sessionCache.size;
  reelRail.setLoading(false);
  reelRail.setCooking(false);

  const nextSession = getLatestStoredSession();
  if (nextSession) {
    restoreSession(nextSession);
    return;
  }

  resetReelState('');
  syncDeleteAvailability();
  reelRail.setStatus('Upload a PDF or paste text to load reels.');
  reelRail.hide();
  importDialog.setMinimized(false);
  importDialog.setButtonText('Upload another PDF or text');
  showEmptyReel();
}

function normalizeSessionReels(reels: Reel[]): Reel[] {
  return [...reels]
    .sort((a, b) => a.index - b.index)
    .map((reel, index) => ({ ...reel, index }));
}

async function deleteReelFromSession(reelToDelete: Reel): Promise<void> {
  const session = sessionCache.get(reelToDelete.docId);
  if (!session) {
    return;
  }

  const confirmed = await confirmDeletion({
    title: 'Delete Reel?',
    message: reelToDelete.title || `Reel ${reelToDelete.index + 1}`,
    confirmLabel: 'Delete reel'
  });
  if (!confirmed) {
    return;
  }

  const originalReels = [...session.reels].sort((a, b) => a.index - b.index);
  const deleteIndex = originalReels.findIndex((reel) => reel.reelId === reelToDelete.reelId);
  if (deleteIndex < 0) {
    return;
  }

  const remainingReels = normalizeSessionReels(
    originalReels.filter((reel) => reel.reelId !== reelToDelete.reelId)
  );

  if (remainingReels.length === 0) {
    await deleteActiveReelGroup({ skipConfirm: true });
    return;
  }

  const nextActiveReel =
    reelState.activeReelId === reelToDelete.reelId
      ? remainingReels[Math.min(deleteIndex, remainingReels.length - 1)] ?? remainingReels[0]
      : remainingReels.find((reel) => reel.reelId === reelState.activeReelId) ?? remainingReels[0];

  const updatedSession: StoredReelSession = {
    ...session,
    reels: remainingReels,
    activeReelId: nextActiveReel?.reelId ?? null,
    updatedAt: new Date().toISOString()
  };

  sessionCache.set(updatedSession.docId, updatedSession);
  saveOrUpdateSession(updatedSession);

  if (reelState.docId === updatedSession.docId) {
    restoreSession(updatedSession);
    return;
  }

  syncRailFromSessions({
    currentUploadId: reelState.docId,
    activeReelId: reelState.activeReelId
  });
}

async function ingestFile(file: File): Promise<void> {
  await ingestDocument(() => createDocFromFile(file), {
    sessionLabel: buildSessionLabel('file', reelState.documentCount + 1, file.name),
    loadingText: 'Uploading PDF...',
    railStatus: 'Uploading your PDF...'
  });
}

async function ingestText(text: string): Promise<void> {
  activeText = text;
  await ingestDocument(() => createDocFromText(text), {
    sessionLabel: buildSessionLabel('text', reelState.documentCount + 1),
    loadingText: 'Chunking your text...',
    railStatus: 'Chunking your text into reels...'
  });
}

async function ingestDocument(
  createDoc: () => Promise<{ docId: string }>,
  options: { sessionLabel: string; loadingText: string; railStatus: string }
): Promise<void> {
  closeReelStream();
  reelRail.setLoading(true);
  reelRail.setCooking(false);
  reelsPlayer.setLoading(true, options.loadingText);
  reelsPlayer.updateStatus(0, false);
  // If content already exists keep the button minimized during re-upload; otherwise center it
  if (reelState.docId) {
    importDialog.setMinimized(true);
    importDialog.setButtonText('Processing…');
  } else {
    importDialog.setMinimized(false);
    importDialog.setButtonText('Processing…');
  }

  try {
    const { docId } = await createDoc();
    const nowIso = new Date().toISOString();

    activeSessionCreatedAt = nowIso;
    reelState.documentCount += 1;
    resetReelState(docId);
    syncDeleteAvailability();
    reelState.currentPage = {
      docId,
      totalReels: 0,
      offset: 0,
      limit: REEL_PAGE_LIMIT,
      reels: [],
      prevOffset: null,
      nextOffset: null
    };

    const session = {
      docId,
      label: options.sessionLabel,
      reels: [],
      activeReelId: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    saveOrUpdateSession(session);
    sessionCache.set(docId, session);
    markVisitedApp();

    reelRail.setStatus(options.railStatus);
    reelRail.show();
    syncRailFromSessions({ currentUploadId: docId, activeReelId: null });
    reelRail.setCooking(true);
    reelsPlayer.clearReels();
    showEmptyReel();

    stopReelStream = streamReels(
      docId,
      (reel) => handleStreamedReel(docId, reel),
      () => finalizeStream(docId)
    );
    stopReelPoll = startReelPoll(docId);
  } catch (error) {
    console.error(error);
    reelRail.show();
    reelRail.setStatus('Failed to process document. Please try again.');
    reelRail.setLoading(false);
    reelsPlayer.setLoading(false);
    reelRail.setCooking(false);
  }
}

function handleStreamedReel(docId: string, reel: Reel): void {
  syncDocReels(docId, [reel]);
}

async function fetchAllReelsForDoc(docId: string): Promise<Reel[]> {
  const allReels: Reel[] = [];
  let offset = 0;

  while (true) {
    const page = await getReelPage(docId, offset, REEL_PAGE_LIMIT);
    if (page.reels.length === 0) {
      break;
    }

    allReels.push(...page.reels);

    if (page.nextOffset === null) {
      break;
    }

    offset = page.nextOffset;
  }

  return mergeReels([], allReels);
}

async function finalizeStream(docId: string): Promise<void> {
  if (stopReelPoll) {
    stopReelPoll();
    stopReelPoll = null;
  }

  if (reelState.docId !== docId) return;

  stopReelStream = null;
  reelRail.setLoading(false);
  reelRail.setCooking(false);
  reelsPlayer.setLoading(false);

  try {
    const allReels = await fetchAllReelsForDoc(docId);
    if (allReels.length > 0) {
      syncDocReels(docId, allReels);
    }
  } catch (error) {
    console.warn('Failed to fetch full reel set after stream completion:', error);
  }

  const total = reelState.currentPage?.reels.length ?? 0;
  reelsPlayer.updateStatus(total, true);

  if (total === 0) {
    reelRail.setStatus('No reels were generated.');
    showEmptyReel();
    return;
  }

  importDialog.setMinimized(true);
  importDialog.setButtonText('+ Add more');

  persistCurrentSession(docId, reelState.currentPage?.reels ?? [], reelState.activeReelId);
}

function mergeReels(existing: Reel[], incoming: Reel[]): Reel[] {
  const merged = new Map<string, Reel>();

  existing.forEach((reel) => {
    merged.set(reel.reelId, reel);
  });

  incoming.forEach((reel) => {
    merged.set(reel.reelId, reel);
  });

  return [...merged.values()].sort((a, b) => a.index - b.index);
}

function syncDocReels(docId: string, incomingReels: Reel[]): void {
  if (incomingReels.length === 0) return;

  const cachedSession = sessionCache.get(docId);
  const mergedReels = mergeReels(cachedSession?.reels ?? [], incomingReels);
  const activeReelId =
    reelState.docId === docId ? reelState.activeReelId : (cachedSession?.activeReelId ?? null);

  persistCurrentSession(docId, mergedReels, activeReelId);
  syncRailFromSessions({
    currentUploadId: reelState.docId === docId ? docId : reelState.docId,
    activeReelId: reelState.docId === docId ? reelState.activeReelId : reelState.activeReelId
  });

  if (reelState.docId !== docId) {
    return;
  }

  const currentPage = reelState.currentPage ?? {
    docId,
    totalReels: 0,
    offset: 0,
    limit: REEL_PAGE_LIMIT,
    reels: [],
    prevOffset: null,
    nextOffset: null
  };

  reelState.currentPage = {
    ...currentPage,
    totalReels: mergedReels.length,
    limit: Math.max(REEL_PAGE_LIMIT, mergedReels.length),
    reels: mergedReels
  };

  reelRail.show();
  reelRail.setLoading(false);
  reelsPlayer.setLoading(false);

  if (mergedReels.length > 0 && !reelState.activeReelId) {
    reelsPlayer.clearReels();
  }

  mergedReels.forEach((reel) => {
    reelsPlayer.addReel(reel);
  });
  reelsPlayer.updateStatus(mergedReels.length, false);

  if (!reelState.activeReelId && mergedReels[0]) {
    // First reel arrived — collapse the import button to its minimal pill form
    importDialog.setMinimized(true);
    importDialog.setButtonText('+ Add more');
    selectReel(mergedReels[0], true);
  }
}

function startReelPoll(docId: string): () => void {
  let stopped = false;
  let timer: number | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;

    try {
      const [status, page] = await Promise.all([
        getDocStatus(docId),
        getReelPage(docId, 0, REEL_PAGE_LIMIT)
      ]);

      if (page.reels.length > 0) {
        syncDocReels(docId, page.reels);
      }

      if (status.state === 'ready' || status.state === 'error') {
        if (reelState.docId === docId) {
          void finalizeStream(docId);
        }
        return;
      }
    } catch (error) {
      console.warn('Reel polling fallback failed:', error);
    }

    if (!stopped) {
      timer = window.setTimeout(() => {
        void tick();
      }, 400);
    }
  };

  void tick();

  return () => {
    stopped = true;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
}

async function navigateToNextReel(): Promise<void> {
  const nextIndex = reelState.currentReelIndex + 1;
  const page = reelState.currentPage;

  // If no page state, we can't navigate.
  if (!page) return;

  // Check if next reel is already in current page
  const nextReel = page.reels.find(r => r.index === nextIndex);

  // If not in current page, check if we have a next page offset
  if (!nextReel && page.nextOffset === null) {
    // End of list
    return;
  }

  if (nextReel) {
    selectReel(nextReel, false);
    reelRail.setActive(nextReel.reelId);
  } else if (page.nextOffset !== null) {
    await loadReelPage(page.nextOffset, 'start');
    const newPage = reelState.currentPage;
    const firstReel = newPage?.reels.find(r => r.index === nextIndex);
    if (firstReel) {
      selectReel(firstReel, false);
      reelRail.setActive(firstReel.reelId);
    }
  }
}

async function navigateToPreviousReel(): Promise<void> {
  const prevIndex = reelState.currentReelIndex - 1;
  if (prevIndex < 0) return;

  const page = reelState.currentPage;
  if (!page) return;

  // Check if prev reel is in current page
  const prevReel = page.reels.find(r => r.index === prevIndex);

  // If not in current page, check if we have a prev page offset
  if (!prevReel && page.prevOffset === null) {
    return;
  }

  if (prevReel) {
    selectReel(prevReel, false);
    reelRail.setActive(prevReel.reelId);
  } else if (page.prevOffset !== null) {
    await loadReelPage(page.prevOffset, 'end');
    const newPage = reelState.currentPage;
    const lastReel = newPage?.reels[newPage.reels.length - 1];
    if (lastReel) {
      selectReel(lastReel, false);
      reelRail.setActive(lastReel.reelId);
    }
  }
}

function showEmptyReel(): void {
  reelsPlayer.showEmptyState(true, {
    message: 'No reels yet — upload a PDF or paste text to get started.'
  });
  applyBackgroundAndTone(manualBackgroundId || 'intro');
  reader.pause();
}

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }

  switch (event.key) {
    case ' ':
      event.preventDefault();
      togglePlaybackFromStartIfEnded();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      reader.seek(-1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      reader.seek(1);
      break;
    case 'ArrowDown':
    case 'PageDown':
      event.preventDefault();
      void navigateToNextReel();
      break;
    case 'ArrowUp':
    case 'PageUp':
      event.preventDefault();
      void navigateToPreviousReel();
      break;
    default:
      break;
  }
});

// Wheel events are now handled internally by ReelsPlayer to allow native physics/snapping


async function loadReelPage(offset: number, align: 'start' | 'end'): Promise<void> {
  if (!reelState.docId) return;
  reelRail.setLoading(true);

  try {
    const page = await requestReelPage(offset);
    reelState.currentPage = page;

    if (page.reels.length === 0) {
      reelRail.setStatus('No reels available.');
      reelRail.setLoading(false);
      return;
    }

    syncRailFromSessions({
      currentUploadId: reelState.docId,
      activeReelId: reelState.activeReelId
    });
    reelRail.setLoading(false);

    if (!reelState.activeReelId && page.reels[0]) {
      selectReel(page.reels[0], false);
    }

    prefetchPage(page.prevOffset);
    prefetchPage(page.nextOffset);
  } catch (error) {
    console.error(error);
    reelRail.setStatus('Unable to load reels.');
    reelRail.setLoading(false);
  }
}

function resetReelState(docId: string): void {
  reelState.docId = docId;
  reelState.activeReelId = null;
  reelState.currentReelIndex = -1;
  reelState.currentPage = null;
  reelCache.clear();
  reelRequests.clear();
  reelsPlayer.clearReels();
}

async function requestReelPage(offset: number): Promise<ReelPage> {
  if (
    reelState.currentPage &&
    reelState.currentPage.offset === 0 &&
    reelState.currentPage.reels.length === reelState.currentPage.totalReels &&
    offset === 0
  ) {
    return reelState.currentPage;
  }

  const cached = reelCache.get(offset);
  if (cached) return cached;

  const pending = reelRequests.get(offset);
  if (pending) return pending;

  const request = getReelPage(reelState.docId, offset, REEL_PAGE_LIMIT).then((page) => {
    reelCache.set(page.offset, page);
    reelRequests.delete(offset);
    return page;
  }).catch((error) => {
    reelRequests.delete(offset);
    throw error;
  });

  reelRequests.set(offset, request);
  return request;
}

function prefetchPage(offset: number | null): void {
  if (offset === null || reelCache.has(offset) || reelRequests.has(offset)) return;
  void requestReelPage(offset);
}

function clearReelAutoplayTimeout(): void {
  if (reelAutoplayTimeout !== null) {
    window.clearTimeout(reelAutoplayTimeout);
    reelAutoplayTimeout = null;
  }
}

function selectReel(reel: Reel, autoplay: boolean, scroll: boolean = true): void {
  clearReelAutoplayTimeout();
  reelState.activeReelId = reel.reelId;
  reelState.currentReelIndex = reel.index;
  reelState.docId = reel.docId;
  activeText = reel.text;
  updateSessionActiveReel(reel.docId, reel.reelId);
  const currentSession = sessionCache.get(reel.docId);
  if (currentSession) {
    sessionCache.set(reel.docId, {
      ...currentSession,
      activeReelId: reel.reelId,
      updatedAt: new Date().toISOString()
    });
  }
  reelsPlayer.showEmptyState(false);
  settingsPanel.setActiveReel(reel.reelId);
  reelRail.setCurrentUpload(reel.docId);
  reelRail.setActive(reel.reelId);

  if (scroll) {
    reelsPlayer.scrollToReel(reel.reelId);
  }

  // Update central background (standard mode)
  if (manualBackgroundId) {
    applyBackgroundAndTone(manualBackgroundId);
  } else if (activeStyle === 'cartoon') {
    const cartoons = ['stickman', 'blobs', 'rain'];
    const randomId = cartoons[Math.floor(Math.random() * cartoons.length)];
    applyBackgroundAndTone(randomId);
  } else if (activeStyle === 'calming') {
    applyBackgroundAndTone(reel.backgroundId);
  }

  const reelFrames = buildReelFrames(reel, currentChunkSize);

  if (!autoplay) {
    reader.pause();
  }

  reader.setFrames(reelFrames, { preservePosition: false });

  if (autoplay) {
    reader.seek(-reader.getState().currentIndex);
    reelsPlayer.setProgress(0, reelFrames.length);
    reader.play();
  } else {
    reader.seek(-reader.getState().currentIndex);
    reelsPlayer.setProgress(0, reelFrames.length);
  }
}

function buildReelFrames(reel: Reel, chunkSize: number): Frame[] {
  const script = reel.characterScript ?? [];
  if (script.length === 0) {
    return groupTokens(tokenize(reel.text), chunkSize);
  }

  const frames: Frame[] = [];
  let frameIndex = 0;
  let tokenOffset = 0;

  script.forEach((line) => {
    if (!line.text) return;
    const tokens = tokenize(line.text);
    const lineFrames = groupTokens(tokens, chunkSize).map((frame) => ({
      ...frame,
      index: frameIndex++,
      startTokenIndex: frame.startTokenIndex + tokenOffset,
      endTokenIndex: frame.endTokenIndex + tokenOffset,
      characterId: line.characterId,
      characterSide: line.side,
      characterAssetUri: line.assetUri
    }));
    frames.push(...lineFrames);
    tokenOffset += tokens.length;
  });

  return frames;
}

function persistCurrentSession(docId: string, reels: Reel[], activeReelId: string | null): void {
  const cachedSession = sessionCache.get(docId);
  const session = {
    docId,
    label: cachedSession?.label || reels[0]?.title || `Upload ${sessionCache.size}`,
    reels,
    activeReelId,
    createdAt: activeSessionCreatedAt,
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(docId, session);
  saveOrUpdateSession(session);
}
