import './styles/main.css';

import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import { createDocFromFile, createDocFromText, getReelPage, streamReels } from './api/client';
import type { Reel, ReelPage } from './api/types';
import type { Frame } from './reader/types';
import {
  getStoredSessions,
  markVisitedApp,
  saveOrUpdateSession,
  updateSessionActiveReel,
  type StoredReelSession
} from './storage/reelSessionStore';
import { Background } from './ui/Background';
import { Controls } from './ui/Controls';
import { ImportDialog } from './ui/ImportDialog';
import { ReelRail } from './ui/ReelRail';
import { ReaderView } from './ui/ReaderView';
import { SeekBar } from './ui/SeekBar';
import { SettingsPanel } from './ui/SettingsPanel';
import { ReelsPlayer, DisplayMode } from './ui/ReelsPlayer';
import { SettingsButton } from './ui/SettingsButton';
import { backgroundCatalog, getBackgroundDefinition } from './ui/backgrounds/catalog';

const SAMPLE_TEXT =
  'Read Fast is a minimalist speed reading demo. It keeps the words steady, inside two calm guide bars, so your eyes stay centered. Use the controls to play, pause, or adjust the speed. Tap space to start, then arrow keys to jump or change pace.';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App container not found');
}
document.body.classList.add('mode-standard');

const background = new Background(app);
background.start();

const DEFAULT_WPM = 250;
const DEFAULT_CHUNK_SIZE = 2;
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

const readerShell = document.createElement('div');
readerShell.className = 'reader-shell';
app.append(readerShell);

const readerView = new ReaderView(readerShell);
const controlsStack = document.createElement('div');
controlsStack.className = 'controls-stack';
app.append(controlsStack);

const controls = new Controls(controlsStack, DEFAULT_WPM);
const seekBar = new SeekBar(controls.getElement());
controls.getElement().insertBefore(seekBar.getElement(), controls.getSlidersElement());

const reelsPlayer = new ReelsPlayer(app);
const settingsPanel = new SettingsPanel(controlsStack, DEFAULT_WPM);
const settingsButton = new SettingsButton(controlsStack);
let stopReelStream: (() => void) | null = null;
reelsPlayer.setWpm(DEFAULT_WPM);

// Bind settings button to toggle settings panel
settingsButton.bind(() => settingsPanel.toggle());
settingsPanel.open();

// Bind settings panel handlers
settingsPanel.bind({
  onModeChange: (mode: DisplayMode) => {
    clearReelAutoplayTimeout();
    const isPortrait = mode === DisplayMode.Portrait;
    reelsPlayer.setMode(mode);
    document.body.classList.toggle('mode-portrait', isPortrait);
    document.body.classList.toggle('mode-standard', !isPortrait);

    // Position settings and panel
    if (isPortrait) {
      reelsPlayer.getContentElement().appendChild(settingsButton.getElement());
      reelsPlayer.getContentElement().appendChild(settingsPanel.getElement());
    } else {
      controlsStack.appendChild(settingsButton.getElement());
      controlsStack.appendChild(settingsPanel.getElement());
    }

    if (isPortrait) {
      // Auto-play if not playing
      if (!reader.getState().isPlaying && reelState.activeReelId) {
        reader.play();
      }

      // If no document or no reels yet, show empty state
      if (!reelState.docId || !reelState.activeReelId) {
        showEmptyReel();
      }
      settingsPanel.close();
    } else {
      const nextFrames = groupTokens(tokenize(activeText), currentChunkSize);
      reader.setFrames(nextFrames, { preservePosition: false });
      readerView.setFrame(nextFrames[0] ?? null);
      settingsPanel.open();
    }

    // Move background element for clipping
    const bgEl = document.querySelector('.bg-layer');
    if (bgEl instanceof HTMLElement) {
      if (isPortrait) {
        reelsPlayer.getContentElement().insertBefore(bgEl, reelsPlayer.getContentElement().firstChild);
      } else {
        app.insertBefore(bgEl, app.firstChild);
      }
    }
  },
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
    if (document.body.classList.contains('mode-portrait')) {
      reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
    }
  },
  onRewind: () => reader.seek(-3),
  onForward: () => reader.seek(3),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onReelSelect: (reel) => {
    selectReel(reel, true);
  }
});

reelsPlayer.bind({
  onPlayPause: () => {
    togglePlaybackFromStartIfEnded();
    reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
  },
  onSeek: (delta) => reader.seek(delta),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onActiveReelChange: (reelId: string) => {
    // When the user scrolls manually, sync the rest of the app
    const reel = reelState.currentPage?.reels.find(r => r.reelId === reelId);
    if (reel) {
      selectReel(reel, true, false); // autoplay true, scroll false
    }
  }
});

let activeStyle: string = 'calming';
let manualBackgroundId: string | null = null;

const reader = new Reader({
  frames,
  wpm: DEFAULT_WPM,
  onFrame: (frame) => {
    readerView.setFrame(frame);
    reelsPlayer.setFrame(frame);
  },
  onStateChange: (state) => {
    controls.setPlaying(state.isPlaying);
    reelsPlayer.setPlaying(state.isPlaying);
    reelsPlayer.setProgress(state.currentIndex, state.totalFrames);
    settingsPanel.setPlaying(state.isPlaying);
    controls.setWpm(state.wpm);
    settingsPanel.setWpm(state.wpm);
    reelsPlayer.setWpm(state.wpm);
    seekBar.setProgress(state.currentIndex, state.totalFrames);
    controls.setFocusMode(state.isPlaying);
  }
});

reader.setFrames(frames, { preservePosition: false });
readerView.setFrame(frames[0] ?? null);

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

function syncRailFromSessions(options?: { currentUploadId?: string | null; activeReelId?: string | null }): void {
  const sessions = getOrderedSessions();
  if (sessions.length === 0) {
    reelRail.setUploads([]);
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
      currentUploadId: options?.currentUploadId ?? reelState.docId,
      activeReelId: options?.activeReelId ?? reelState.activeReelId
    }
  );
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
  settingsPanel.setMode(DisplayMode.Portrait);
  reelsPlayer.setMode(DisplayMode.Portrait);
  document.body.classList.add('mode-portrait');
  document.body.classList.remove('mode-standard');

  reelsPlayer.getContentElement().appendChild(settingsButton.getElement());
  reelsPlayer.getContentElement().appendChild(settingsPanel.getElement());

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

  settingsPanel.setReels(reels, { activeReelId: session.activeReelId ?? undefined, align: 'start' });

  reelsPlayer.clearReels();
  reels.forEach((reel) => reelsPlayer.addReel(reel));
  reelsPlayer.updateStatus(reels.length, true);
  reelsPlayer.setLoading(false);
  reelRail.setLoading(false);

  importDialog.setMinimized(false);
  importDialog.setButtonText('Upload another PDF or text');

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

controls.bind({
  onPlayPause: () => togglePlaybackFromStartIfEnded(),
  onRestart: () => {
    reader.pause();
    reader.seek(-reader.getState().currentIndex);
  },
  onRewind: () => reader.seek(-3),
  onForward: () => reader.seek(3),
  onWpmChange: (wpm) => reader.setWpm(wpm)
});

seekBar.bind({
  onSeek: (index) => {
    const state = reader.getState();
    reader.seek(index - state.currentIndex);
  },
  onJump: (delta) => {
    reader.seek(delta);
  }
});

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
  importDialog.setMinimized(false);
  importDialog.setButtonText('Upload another PDF or text');

  try {
    const { docId } = await createDoc();
    const nowIso = new Date().toISOString();

    activeSessionCreatedAt = nowIso;
    reelState.documentCount += 1;
    resetReelState(docId);
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
    settingsPanel.setReels([]);
    reelsPlayer.clearReels();
    showEmptyReel();

    stopReelStream = streamReels(
      docId,
      (reel) => handleStreamedReel(docId, reel),
      () => finalizeStream(docId)
    );
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
  if (reelState.docId !== docId) return;

  const currentPage = reelState.currentPage;
  if (!currentPage) return;

  const nextReels = [...currentPage.reels];
  const existingIndex = nextReels.findIndex((item) => item.reelId === reel.reelId);
  if (existingIndex >= 0) {
    nextReels[existingIndex] = reel;
  } else {
    nextReels.push(reel);
    nextReels.sort((a, b) => a.index - b.index);
  }

  reelState.currentPage = {
    ...currentPage,
    totalReels: nextReels.length,
    limit: Math.max(REEL_PAGE_LIMIT, nextReels.length),
    reels: nextReels,
    prevOffset: null,
    nextOffset: null
  };

  reelRail.show();
  reelRail.setLoading(false);
  settingsPanel.setReels(nextReels, { activeReelId: reelState.activeReelId ?? undefined, align: 'end' });
  reelsPlayer.setLoading(false);

  if (nextReels.length === 1 && !reelState.activeReelId) {
    reelsPlayer.clearReels();
  }

  reelsPlayer.addReel(reel);
  reelsPlayer.updateStatus(nextReels.length, false);

  if (!reelState.activeReelId) {
    selectReel(reel, true);
  }

  persistCurrentSession(docId, nextReels, reelState.activeReelId);
  syncRailFromSessions({
    currentUploadId: docId,
    activeReelId: reelState.activeReelId
  });
}

function finalizeStream(docId: string): void {
  if (reelState.docId !== docId) return;

  stopReelStream = null;
  reelRail.setLoading(false);
  reelRail.setCooking(false);
  reelsPlayer.setLoading(false);

  const total = reelState.currentPage?.reels.length ?? 0;
  reelsPlayer.updateStatus(total, true);

  if (total === 0) {
    reelRail.setStatus('No reels were generated.');
    showEmptyReel();
    return;
  }

  persistCurrentSession(docId, reelState.currentPage?.reels ?? [], reelState.activeReelId);
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
    selectReel(nextReel, true);
    reelRail.setActive(nextReel.reelId);
    scheduleReelAutoplay(nextReel.reelId);
  } else if (page.nextOffset !== null) {
    await loadReelPage(page.nextOffset, 'start');
    const newPage = reelState.currentPage;
    const firstReel = newPage?.reels.find(r => r.index === nextIndex);
    if (firstReel) {
      selectReel(firstReel, true);
      reelRail.setActive(firstReel.reelId);
      scheduleReelAutoplay(firstReel.reelId);
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
    selectReel(prevReel, true);
    reelRail.setActive(prevReel.reelId);
    scheduleReelAutoplay(prevReel.reelId);
  } else if (page.prevOffset !== null) {
    await loadReelPage(page.prevOffset, 'end');
    const newPage = reelState.currentPage;
    const lastReel = newPage?.reels[newPage.reels.length - 1];
    if (lastReel) {
      selectReel(lastReel, true);
      reelRail.setActive(lastReel.reelId);
      scheduleReelAutoplay(lastReel.reelId);
    }
  }
}

function showEmptyReel(): void {
  reelsPlayer.showEmptyState(true, {
    message: 'No reels yet — upload a PDF or paste text to get started.'
  });
  settingsPanel.setReels([]);
  applyBackgroundAndTone(manualBackgroundId || 'intro');
  reader.pause();
}

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }

  const isPortraitMode = document.body.classList.contains('mode-portrait');

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
      if (isPortraitMode) {
        void navigateToNextReel();
      } else {
        reader.setWpm(reader.getState().wpm - 25);
      }
      break;
    case 'ArrowUp':
    case 'PageUp':
      event.preventDefault();
      if (isPortraitMode) {
        void navigateToPreviousReel();
      } else {
        reader.setWpm(reader.getState().wpm + 25);
      }
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
    settingsPanel.setReels(page.reels, { activeReelId: reelState.activeReelId || undefined, align });
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
  reelState.currentReelIndex = 0;
  reelState.currentPage = null;
  reelCache.clear();
  reelRequests.clear();
  settingsPanel.setReels([]);
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

function scheduleReelAutoplay(reelId: string): void {
  clearReelAutoplayTimeout();
  if (reelsPlayer.getMode() !== DisplayMode.Portrait) {
    reader.play();
    return;
  }

  reelAutoplayTimeout = window.setTimeout(() => {
    reelAutoplayTimeout = null;
    if (reelState.activeReelId !== reelId) return;
    if (reelsPlayer.getMode() !== DisplayMode.Portrait) return;
    reader.play();
  }, REEL_TRANSITION_PAUSE_MS);
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

  script.forEach((line) => {
    if (!line.text) return;
    const tokens = tokenize(line.text);
    const lineFrames = groupTokens(tokens, chunkSize).map((frame) => ({
      ...frame,
      index: frameIndex++,
      characterId: line.characterId,
      characterSide: line.side,
      characterAssetUri: line.assetUri
    }));
    frames.push(...lineFrames);
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
