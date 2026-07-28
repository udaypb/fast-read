import './styles/main.css';

import { inject } from '@vercel/analytics';
import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import type { Reel, ReelPage } from './api/types';
import { extractTextFromPdf } from './processing/pdfExtract';
import { createLocalRenderModel } from './processing/renderModel';
import { TextProcessorClient } from './processing/TextProcessorClient';
import type { Frame } from './reader/types';
import {
  deleteStoredSession,
  clearStoredSessions,
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
import { backgroundCatalog, getBackgroundDefinition, getBackgroundTextTone } from './ui/backgrounds/catalog';
import { BackgroundType } from './ui/backgrounds/types';

inject();

const SAMPLE_TEXT =
  'Read Fast is a minimalist speed reading demo. It keeps the words steady, inside two calm guide bars, so your eyes stay centered. Use the controls to play, pause, or adjust the speed. Tap space to start, then arrow keys to jump or change pace.';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App container not found');
}
document.body.classList.add('mode-portrait');

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function preventNativePageGesture(event: Event): void {
  if (isEditableTarget(event.target)) return;
  event.preventDefault();
}

document.addEventListener('dblclick', preventNativePageGesture, { capture: true });
document.addEventListener('selectstart', preventNativePageGesture, { capture: true });
document.addEventListener('dragstart', preventNativePageGesture, { capture: true });
document.addEventListener('contextmenu', preventNativePageGesture, { capture: true });
document.addEventListener('gesturestart', preventNativePageGesture, { capture: true, passive: false });
document.addEventListener('gesturechange', preventNativePageGesture, { capture: true, passive: false });
document.addEventListener('gestureend', preventNativePageGesture, { capture: true, passive: false });

const background = new Background(app);
background.start();
const confirmDialog = new ConfirmDialog();

const DEFAULT_WPM = 250;
const DEFAULT_CHUNK_SIZE = 1;
const REEL_PAGE_LIMIT = 5;
const MAX_LOCAL_TEXT_WORDS = 50000;
const textProcessor = new TextProcessorClient();
const CYCLABLE_BACKGROUND_CATEGORIES = new Set([
  'satisfying',
  'subway',
  'minecraft',
  'temple',
  'fortnite',
  'real',
  'calming',
  'cartoon'
]);
const cyclableBackgrounds = backgroundCatalog.filter((backgroundItem) => (
  backgroundItem.category &&
  CYCLABLE_BACKGROUND_CATEGORIES.has(backgroundItem.category) &&
  backgroundItem.category !== 'intro' &&
  (backgroundItem.type === BackgroundType.Video || backgroundItem.type === BackgroundType.Vanta || backgroundItem.type === BackgroundType.Custom)
));

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
  if (options?.allowManualTone !== false) {
    setReadingTextTone(getBackgroundTextTone(styleId));
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
reelsPlayer.setWpm(DEFAULT_WPM);

// Bind settings button to toggle settings panel
settingsButton.bind(() => settingsPanel.toggle());

// Bind settings panel handlers
settingsPanel.bind({
  onStyleChange: (_style: string, specificId?: string) => {
    if (specificId) {
      updateActiveReelBackground(specificId);
      return;
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
  },
  onGroupSelect: (docId) => {
    if (reelState.docId === docId) {
      return;
    }

    const session = sessionCache.get(docId);
    if (session) {
      restoreSession(session);
    }
  },
  onDeleteGroup: (docId) => {
    if (reelState.docId !== docId) {
      const session = sessionCache.get(docId);
      if (!session) {
        return;
      }
      restoreSession(session);
    }
    void deleteActiveReelGroup();
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
  onCycleBackground: () => {
    cycleActiveReelBackground();
  },
  onActiveReelChange: (reelId: string) => {
    // When the user scrolls manually, sync the rest of the app
    const reel = reelState.currentPage?.reels.find(r => r.reelId === reelId);
    if (reel) {
      selectReel(reel, false, false);
    }
  }
});

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
  reelRequests.clear();
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

async function clearAllReadingData(): Promise<void> {
  const confirmed = await confirmDeletion({
    title: 'Clear All Reading Data?',
    message: 'Remove every saved upload and reel from this browser?',
    confirmLabel: 'Clear all'
  });
  if (!confirmed) {
    return;
  }

  reader.pause();
  closeReelStream();
  sessionCache.clear();
  clearStoredSessions();
  reelState.documentCount = 0;
  activeSessionCreatedAt = new Date().toISOString();
  activeText = SAMPLE_TEXT;

  resetReelState('');
  syncDeleteAvailability();
  syncRailFromSessions({ currentUploadId: null, activeReelId: null });
  reelRail.setStatus('Upload a PDF or paste text to load reels.');
  reelRail.setLoading(false);
  reelRail.setCooking(false);
  reelRail.hide();
  reelsPlayer.updateStatus(0, true);
  reelsPlayer.setLoading(false);
  importDialog.setMinimized(false);
  importDialog.setButtonText('Upload another PDF or text');
  settingsPanel.close();
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
  await ingestDocument(() => extractReadableTextFromFile(file), {
    sessionLabel: buildSessionLabel('file', reelState.documentCount + 1, file.name),
    loadingText: file.type === 'application/pdf' ? 'Reading PDF...' : 'Reading file...',
    railStatus: 'Reading your file locally...'
  });
}

async function ingestText(text: string): Promise<void> {
  await ingestDocument(() => Promise.resolve(text), {
    sessionLabel: buildSessionLabel('text', reelState.documentCount + 1),
    loadingText: 'Chunking your text...',
    railStatus: 'Chunking your text into reels...'
  });
}

async function ingestDocument(
  readText: () => Promise<string>,
  options: { sessionLabel: string; loadingText: string; railStatus: string }
): Promise<void> {
  const previousDocId = reelState.docId || null;
  const previousActiveReelId = reelState.activeReelId;
  const shouldActivateNewSession = !previousDocId;

  closeReelStream();
  if (!shouldActivateNewSession) {
    reader.pause();
  }
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
    const text = normalizeInputText(await readText());
    const wordCount = countWords(text);

    if (!text || wordCount === 0) {
      throw new Error('No readable text was found in this document.');
    }

    if (wordCount > MAX_LOCAL_TEXT_WORDS) {
      throw new Error(`Please use ${MAX_LOCAL_TEXT_WORDS.toLocaleString()} words or fewer.`);
    }

    reelsPlayer.setLoading(true, 'Building reels...');
    const { frames } = await textProcessor.process(text, currentChunkSize);
    const docId = createLocalDocId();
    const { reels } = createLocalRenderModel(docId, frames);
    const firstReelId = reels[0]?.reelId ?? null;
    const nowIso = new Date().toISOString();

    const session = {
      docId,
      label: options.sessionLabel,
      reels,
      activeReelId: firstReelId,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    saveOrUpdateSession(session);
    sessionCache.set(docId, session);
    reelState.documentCount = sessionCache.size;
    markVisitedApp();

    reelRail.setStatus(options.railStatus);
    reelRail.show();
    reelRail.setCooking(false);
    reelsPlayer.setLoading(false);
    reelRail.setLoading(false);
    importDialog.setMinimized(true);
    importDialog.setButtonText('+ Add more');

    if (!shouldActivateNewSession) {
      const activeSession = previousDocId ? sessionCache.get(previousDocId) : null;
      reelsPlayer.updateStatus(activeSession?.reels.length ?? 0, true);
      syncRailFromSessions({
        currentUploadId: previousDocId,
        activeReelId: previousActiveReelId
      });
      return;
    }

    activeText = text;
    restoreSession(session);
    if (!reels[0]) {
      reelRail.setStatus('No reels were generated.');
      showEmptyReel();
    }
  } catch (error) {
    console.error(error);
    reelRail.show();
    reelRail.setStatus(error instanceof Error ? error.message : 'Failed to process document. Please try again.');
    reelRail.setLoading(false);
    reelsPlayer.setLoading(false);
    reelRail.setCooking(false);
    importDialog.setButtonText(reelState.docId ? '+ Add more' : 'Upload another PDF or text');
    importDialog.setMinimized(Boolean(reelState.docId));
  }
}

async function extractReadableTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractTextFromPdf(file);
  }

  if (isTextLikeFile(file)) {
    return file.text();
  }

  throw new Error('This file type is not supported yet. Use a PDF, plain text file, or pasted text.');
}

function isTextLikeFile(file: File): boolean {
  if (file.type.startsWith('text/')) return true;
  return /\.(txt|md|markdown|csv|json|html?|xml)$/i.test(file.name);
}

function normalizeInputText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

function createLocalDocId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  reelsPlayer.showEmptyState(true);
  reelsPlayer.setBackgroundCycleState(null);
  applyBackgroundAndTone('intro');
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
  const cached = reelCache.get(offset);
  if (cached) return cached;

  const pending = reelRequests.get(offset);
  if (pending) return pending;

  const request = Promise.resolve(buildLocalReelPage(reelState.docId, offset, REEL_PAGE_LIMIT)).then((page) => {
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

function buildLocalReelPage(docId: string, offset: number, limit: number): ReelPage {
  const session = sessionCache.get(docId);
  const reels = session?.reels ?? [];
  const boundedOffset = Math.max(0, Math.min(offset, Math.max(reels.length - 1, 0)));
  const pageReels = reels.slice(boundedOffset, boundedOffset + limit);
  const prevOffset = boundedOffset > 0 ? Math.max(0, boundedOffset - limit) : null;
  const nextOffset = boundedOffset + limit < reels.length ? boundedOffset + limit : null;

  return {
    docId,
    totalReels: reels.length,
    offset: boundedOffset,
    limit,
    reels: pageReels,
    prevOffset,
    nextOffset
  };
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

  // Update central background (standard mode) from the reel's persisted background.
  applyBackgroundAndTone(reel.backgroundId);
  reelsPlayer.setBackgroundCycleState(
    getBackgroundDefinition(reel.backgroundId)?.label ?? reel.backgroundLabel ?? reel.backgroundId
  );

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

function updateActiveReelBackground(backgroundId: string): void {
  const activeDocId = reelState.docId;
  const activeReelId = reelState.activeReelId;
  if (!activeDocId || !activeReelId) {
    applyBackgroundAndTone(backgroundId);
    return;
  }

  const definition = getBackgroundDefinition(backgroundId);
  const updateReel = (reel: Reel): Reel => {
    if (reel.reelId !== activeReelId) return reel;
    return {
      ...reel,
      backgroundId,
      backgroundModule: definition?.type ?? reel.backgroundModule,
      backgroundLabel: definition?.label ?? reel.backgroundLabel,
      backgroundDescription: `${definition?.label ?? reel.backgroundLabel} reading background`,
      backgroundMoodTags: definition?.category ? [definition.category] : reel.backgroundMoodTags,
      backgroundIntensity: definition?.type === 'video' ? 65 : reel.backgroundIntensity,
      backgroundMotion: definition?.type === 'video' ? 'video loop' : reel.backgroundMotion,
      backgroundPalette: getBackgroundTextTone(backgroundId) === 'dark' ? 'light' : 'dark',
      backgroundNotes: 'User selected background'
    };
  };

  if (reelState.currentPage?.docId === activeDocId) {
    reelState.currentPage = {
      ...reelState.currentPage,
      reels: reelState.currentPage.reels.map(updateReel)
    };
  }

  const session = sessionCache.get(activeDocId);
  if (session) {
    const updatedSession: StoredReelSession = {
      ...session,
      reels: session.reels.map(updateReel),
      activeReelId,
      updatedAt: new Date().toISOString()
    };
    sessionCache.set(activeDocId, updatedSession);
    saveOrUpdateSession(updatedSession);
    syncRailFromSessions({ currentUploadId: activeDocId, activeReelId });
  }

  reelsPlayer.setReelBackground(activeReelId, backgroundId);
  applyBackgroundAndTone(backgroundId);
  reelsPlayer.setBackgroundCycleState(definition?.label ?? backgroundId);
}

function cycleActiveReelBackground(): void {
  const activeReel = reelState.currentPage?.reels.find((reel) => reel.reelId === reelState.activeReelId);
  if (!activeReel || cyclableBackgrounds.length === 0) {
    return;
  }

  const currentIndex = cyclableBackgrounds.findIndex((backgroundItem) => backgroundItem.id === activeReel.backgroundId);
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % cyclableBackgrounds.length
    : 0;
  const nextBackground = cyclableBackgrounds[nextIndex];
  if (!nextBackground) return;

  updateActiveReelBackground(nextBackground.id);
}

function persistCurrentSession(docId: string, reels: Reel[], activeReelId: string | null): void {
  const cachedSession = sessionCache.get(docId);
  const session = {
    docId,
    label: cachedSession?.label || `Upload ${sessionCache.size}`,
    reels,
    activeReelId,
    createdAt: activeSessionCreatedAt,
    updatedAt: new Date().toISOString()
  };
  sessionCache.set(docId, session);
  saveOrUpdateSession(session);
}
