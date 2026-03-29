import './styles/main.css';

import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import { getReelPage } from './api/client';
import type { Reel, ReelPage } from './api/types';
import type { Frame } from './reader/types';
import { TextProcessorClient } from './processing/TextProcessorClient';
import { extractTextFromPdf } from './processing/pdfExtract';
import { createLocalRenderModel } from './processing/renderModel';
import {
  getLatestSession,
  hasVisitedApp,
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

const DEFAULT_WPM = 300;
const DEFAULT_CHUNK_SIZE = 2;
const REEL_PAGE_LIMIT = 5;
const REEL_TRANSITION_PAUSE_MS = 1000;
const LOCAL_DOC_PREFIX = 'local-doc';

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

const controls = new Controls(controlsStack, DEFAULT_WPM, DEFAULT_CHUNK_SIZE);
const seekBar = new SeekBar(controls.getElement());
controls.getElement().insertBefore(seekBar.getElement(), controls.getSlidersElement());

const reelsPlayer = new ReelsPlayer(app);
const settingsPanel = new SettingsPanel(controlsStack, DEFAULT_WPM, DEFAULT_CHUNK_SIZE);
const settingsButton = new SettingsButton(controlsStack);
const processor = new TextProcessorClient();
const localReelFramesById = new Map<string, Frame[]>();
let localFramesChunkSize = DEFAULT_CHUNK_SIZE;
reelsPlayer.setChunkSize(DEFAULT_CHUNK_SIZE);

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
    reader.toggle();
    if (document.body.classList.contains('mode-portrait')) {
      reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
    }
  },
  onRewind: () => reader.seek(-3),
  onForward: () => reader.seek(3),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onChunkSizeChange: (size) => {
    updateChunkSize(size);
  },
  onReelSelect: (reel) => {
    selectReel(reel, true);
  }
});

reelsPlayer.bind({
  onPlayPause: () => {
    reader.toggle();
    reelsPlayer.showPlayPauseIndicator(reader.getState().isPlaying);
  },
  onSeek: (delta) => reader.seek(delta),
  onChunkSizeChange: (size) => updateChunkSize(size),
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
    seekBar.setProgress(state.currentIndex, state.totalFrames);
    controls.setFocusMode(state.isPlaying);
  }
});

reader.setFrames(frames, { preservePosition: false });
readerView.setFrame(frames[0] ?? null);

const latestSession = getLatestSession();
if (hasVisitedApp()) {
  void bootWithoutIntro(latestSession);
} else {
  void runIntroSequence();
}

async function bootWithoutIntro(session: StoredReelSession | null): Promise<void> {
  markVisitedApp();
  app!.classList.add('ui-entrance');
  activatePortraitMode();

  if (session) {
    restoreSession(session);
    return;
  }

  showEmptyReel();
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
  if (reels.length === 0) {
    showEmptyReel();
    return;
  }

  resetReelState(session.docId);
  reelState.documentCount = Math.max(reelState.documentCount, 1);
  reelState.currentPage = {
    docId: session.docId,
    totalReels: reels.length,
    offset: 0,
    limit: reels.length,
    reels,
    prevOffset: null,
    nextOffset: null
  };

  const uploadLabel = 'Last session';
  reelRail.show();
  reelRail.addUpload(session.docId, uploadLabel);
  reelRail.setReels(reels, { uploadId: session.docId, activeReelId: session.activeReelId ?? undefined, align: 'start' });
  settingsPanel.setReels(reels, { activeReelId: session.activeReelId ?? undefined, align: 'start' });

  reelsPlayer.clearReels();
  reels.forEach((reel) => reelsPlayer.addReel(reel));
  reelsPlayer.updateStatus(reels.length, true);
  reelsPlayer.setLoading(false);
  reelRail.setLoading(false);
  reelRail.setStatus('');

  importDialog.setMinimized(true);
  importDialog.setButtonText('Upload another PDF or text');

  const active = reels.find((reel) => reel.reelId === session.activeReelId) ?? reels[0];
  if (active) {
    selectReel(active, false);
  }
}

async function runIntroSequence() {
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

  // Show empty state since we are just starting
  showEmptyReel();
}

controls.bind({
  onPlayPause: () => reader.toggle(),
  onRestart: () => {
    reader.pause();
    reader.seek(-reader.getState().currentIndex);
  },
  onRewind: () => reader.seek(-3),
  onForward: () => reader.seek(3),
  onWpmChange: (wpm) => reader.setWpm(wpm),
  onChunkSizeChange: (size) => {
    updateChunkSize(size);
  }
});

function updateChunkSize(size: number): void {
  currentChunkSize = size;

  // Sync UI
  controls.setChunkSize(size);
  settingsPanel.setChunkSize(size);
  reelsPlayer.setChunkSize(size);

  const isPortrait = document.body.classList.contains('mode-portrait');

  if (isPortrait && reelState.activeReelId) {
    // Re-chunk current reel
    const reel = reelState.currentPage?.reels.find(r => r.reelId === reelState.activeReelId);
    if (reel) {
      const reelFrames = buildReelFrames(reel, size);
      reader.setFrames(reelFrames, { preservePosition: true });
    } else {
      const nextFrames = groupTokens(tokenize(activeText), currentChunkSize);
      reader.setFrames(nextFrames, { preservePosition: false });
      readerView.setFrame(nextFrames[0] ?? null);
    }
  } else {
    // Re-chunk active text (Standard Mode)
    const nextFrames = groupTokens(tokenize(activeText), size);
    reader.setFrames(nextFrames, { preservePosition: true });
  }
}

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

const reelCache = new Map<number, ReelPage>();
const reelRequests = new Map<number, Promise<ReelPage>>();
let reelAutoplayTimeout: number | null = null;

reelRail.bind({
  onSelect: (reel) => selectReel(reel, true),
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
    void ingestLocalText(text);
  },
  onImportFile: (file) => {
    void ingestLocalFile(file);
  }
});

async function ingestLocalFile(file: File): Promise<void> {
  reelRail.setStatus('Extracting PDF text...');
  reelRail.setLoading(true);
  const isPortrait = reelsPlayer.getMode() === DisplayMode.Portrait;
  if (isPortrait) {
    reelsPlayer.setLoading(true, 'Extracting PDF text...');
  }

  try {
    const text = await extractTextFromPdf(file);
    await ingestLocalText(text);
  } catch (error) {
    console.error(error);
    reelRail.show();
    reelRail.setStatus('Failed to extract PDF text. Please try another file.');
    reelRail.setLoading(false);
    reelsPlayer.setLoading(false);
  }
}

async function ingestLocalText(text: string): Promise<void> {
  reelRail.setStatus('Processing text...');
  reelRail.setLoading(true);

  const isPortrait = reelsPlayer.getMode() === DisplayMode.Portrait;
  if (isPortrait) {
    reelsPlayer.setLoading(true, 'Processing your text...');
  }

  try {
    const { frames: processedFrames } = await processor.process(text, currentChunkSize);
    localFramesChunkSize = currentChunkSize;
    const docId = `${LOCAL_DOC_PREFIX}-${crypto.randomUUID()}`;
    const model = createLocalRenderModel(docId, processedFrames);
    const nowIso = new Date().toISOString();

    reelState.documentCount += 1;
    resetReelState(docId);
    localReelFramesById.clear();
    model.reelFramesById.forEach((value, key) => localReelFramesById.set(key, value));

    reelState.currentPage = {
      docId,
      totalReels: model.reels.length,
      offset: 0,
      limit: Math.max(1, model.reels.length),
      reels: model.reels,
      prevOffset: null,
      nextOffset: null
    };

    saveOrUpdateSession({
      docId,
      reels: model.reels,
      activeReelId: model.reels[0]?.reelId ?? null,
      createdAt: nowIso,
      updatedAt: nowIso
    });
    markVisitedApp();

    reelRail.show();
    reelRail.setCooking(false);
    importDialog.setMinimized(true);
    importDialog.setButtonText('Upload another PDF or text');

    const uploadLabel = `Upload #${reelState.documentCount}`;
    reelRail.addUpload(docId, uploadLabel);
    reelRail.setReels(model.reels, { uploadId: docId, align: 'start' });
    settingsPanel.setReels(model.reels, { align: 'start' });

    reelsPlayer.clearReels();
    model.reels.forEach((reel) => reelsPlayer.addReel(reel));
    reelsPlayer.updateStatus(model.reels.length, true);
    reelsPlayer.setLoading(false);

    activeText = text;

    if (model.reels[0]) {
      selectReel(model.reels[0], true);
    } else {
      reelRail.setStatus('No reels were generated.');
      showEmptyReel();
    }

    reelRail.setLoading(false);
  } catch (error) {
    console.error(error);
    reelRail.show();
    reelRail.setStatus('Failed to process text. Please try again.');
    reelRail.setLoading(false);
    reelsPlayer.setLoading(false);
    reelRail.setCooking(false);
  }
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
  reelsPlayer.showEmptyState(true);
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
      reader.toggle();
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
  if (reelState.docId.startsWith(LOCAL_DOC_PREFIX)) return;
  reelRail.setLoading(true);

  try {
    const page = await requestReelPage(offset);
    reelState.currentPage = page;

    if (page.reels.length === 0) {
      reelRail.setStatus('No reels available.');
      reelRail.setLoading(false);
      return;
    }

    reelRail.setReels(page.reels, { activeReelId: reelState.activeReelId || undefined, align });
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
  reelRail.setReels([]);
  settingsPanel.setReels([]);
  reelsPlayer.clearReels();
}

async function requestReelPage(offset: number): Promise<ReelPage> {
  if (reelState.docId.startsWith(LOCAL_DOC_PREFIX) && reelState.currentPage) {
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
  updateSessionActiveReel(reelState.docId || reel.docId, reel.reelId);
  reelsPlayer.showEmptyState(false);
  settingsPanel.setActiveReel(reel.reelId);

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
  const localFrames = localReelFramesById.get(reel.reelId);
  if (localFrames && chunkSize === localFramesChunkSize) {
    return localFrames;
  }

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
