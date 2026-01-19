import './styles/main.css';

import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import { createDocFromFile, createDocFromText, getReelPage, streamReels } from './api/client';
import type { Reel, ReelPage } from './api/types';
import { Background } from './ui/Background';
import { Controls } from './ui/Controls';
import { ImportDialog } from './ui/ImportDialog';
import { ReelRail } from './ui/ReelRail';
import { ReaderView } from './ui/ReaderView';
import { SeekBar } from './ui/SeekBar';
import { StyleSelector } from './ui/StyleSelector';
import { ModeSelector } from './ui/ModeSelector';
import { ReelsPlayer, DisplayMode } from './ui/ReelsPlayer';
import { backgroundCatalog } from './ui/backgrounds/catalog';

const SAMPLE_TEXT =
  'Fast Read is a minimalist speed reading demo. It keeps the words steady, inside two calm guide bars, so your eyes stay centered. Use the controls to play, pause, or adjust the speed. Tap space to start, then arrow keys to jump or change pace.';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App container not found');
}

const background = new Background(app);
background.start();

const DEFAULT_WPM = 300;
const DEFAULT_CHUNK_SIZE = 3;
const REEL_PAGE_LIMIT = 5;

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

const readerBackdrop = document.createElement('div');
readerBackdrop.className = 'reader-backdrop';
readerShell.append(readerBackdrop);

const readerView = new ReaderView(readerShell);
const controlsStack = document.createElement('div');
controlsStack.className = 'controls-stack';
app.append(controlsStack);

const controls = new Controls(controlsStack, DEFAULT_WPM, DEFAULT_CHUNK_SIZE);
const seekBar = new SeekBar(controls.getElement());
controls.getElement().insertBefore(seekBar.getElement(), controls.getSlidersElement());
const styleSelector = new StyleSelector(controlsStack);

const reelsPlayer = new ReelsPlayer(app);
const modeSelector = new ModeSelector(app);

modeSelector.bind((mode) => {
  const isPortrait = mode === DisplayMode.Portrait;
  reelsPlayer.setMode(mode);
  document.body.classList.toggle('mode-portrait', isPortrait);
  document.body.classList.toggle('mode-standard', !isPortrait);

  if (isPortrait) {
    // Move style selector into player so it floats inside the Reels UI
    reelsPlayer.getContentElement().appendChild(styleSelector.getElement());
    // Auto-play if not playing
    if (!reader.getState().isPlaying) {
      reader.play();
    }
  } else {
    // Move style selector back to controls stack for standard view
    controlsStack.appendChild(styleSelector.getElement());
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
});

reelsPlayer.bind({
  onPlayPause: () => reader.toggle(),
  onStyleClick: () => styleSelector.toggle()
});

let activeStyle: string = 'calming';

const reader = new Reader({
  frames: [],
  wpm: DEFAULT_WPM,
  onFrame: (frame) => {
    readerView.setFrame(frame);
    reelsPlayer.setFrame(frame);
  },
  onStateChange: (state) => {
    controls.setPlaying(state.isPlaying);
    reelsPlayer.setPlaying(state.isPlaying);
    controls.setWpm(state.wpm);
    seekBar.setProgress(state.currentIndex, state.totalFrames);
    controls.setFocusMode(state.isPlaying);
  }
});

void runIntroSequence();

async function runIntroSequence() {
  document.body.classList.add('intro-active');
  await background.setStyle('intro');

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
    'with readfast.live'
  ];

  for (const phrase of introPhrases) {
    introTextEl.textContent = phrase;
    introTextEl.classList.add('intro-text--visible');
    await new Promise(r => setTimeout(r, 800));
    introTextEl.classList.remove('intro-text--visible');
    await new Promise(r => setTimeout(r, 200));
  }

  introTextEl.textContent = 'readfast.live';
  introTextEl.classList.add('intro-text--visible');
  await new Promise(r => setTimeout(r, 1000));

  introTextEl.classList.add('intro-text--vanishing');
  await new Promise(r => setTimeout(r, 1000));

  introTextWrapper.remove();
  document.body.classList.remove('intro-active');
  app!.classList.add('ui-entrance');
  void background.setStyle('net');

  reader.setFrames(frames, { preservePosition: false });
  readerView.setFrame(frames[0] ?? null);
  seekBar.setProgress(0, frames.length);
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
    currentChunkSize = size;
    const nextFrames = groupTokens(tokenize(activeText), size);
    reader.setFrames(nextFrames, { preservePosition: true });
    controls.setChunkSize(size);
  }
});

styleSelector.bind((style, specificId) => {
  activeStyle = style;

  if (specificId) {
    void background.setStyle(specificId);
    return;
  }

  // Default behaviors when switching category only
  if (activeStyle === 'cartoon') {
    const cartoons = ['stickman', 'blobs', 'rain'];
    const randomId = cartoons[Math.floor(Math.random() * cartoons.length)];
    void background.setStyle(randomId);
  } else if (activeStyle === 'calming') {
    const currentReelId = reelState.activeReelId;
    void background.setStyle('net');
    const reel = reelState.currentPage?.reels.find(r => r.reelId === currentReelId);
    if (reel) {
      void background.setStyle(reel.backgroundId);
    }
  } else if (activeStyle === 'real') {
    console.log('Real mode selected (placeholder)');
  } else if (activeStyle === 'satisfying' || activeStyle === 'subway' || activeStyle === 'temple' || activeStyle === 'minecraft') {
    // Auto-select first item if exists
    const item = backgroundCatalog.find(b => b.category === activeStyle);
    if (item) {
      void background.setStyle(item.id);
    }
  }
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
  activeReelId: '',
  currentPage: null as ReelPage | null,
  documentCount: 0
};

const reelCache = new Map<number, ReelPage>();
const reelRequests = new Map<number, Promise<ReelPage>>();

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
    void ingestDoc(() => createDocFromText(text));
  },
  onImportFile: (file) => {
    void ingestDoc(() => createDocFromFile(file));
  }
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return;
  }

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
    case 'ArrowUp':
      event.preventDefault();
      reader.setWpm(reader.getState().wpm + 25);
      break;
    case 'ArrowDown':
      event.preventDefault();
      reader.setWpm(reader.getState().wpm - 25);
      break;
    default:
      break;
  }
});

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

    reelRail.setReels(page.reels, { activeReelId: reelState.activeReelId, align });
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

async function ingestDoc(createDoc: () => Promise<{ docId: string }>): Promise<void> {
  const isFirstUpload = reelState.documentCount === 0;

  reelRail.setStatus('Processing document...');
  reelRail.setLoading(true);
  try {
    const { docId } = await createDoc();
    reelState.documentCount++;

    if (isFirstUpload) {
      resetReelState(docId);
      reelRail.setStatus('');
    } else {
      // For subsequent uploads, we just update the docId to the latest one
      // but we don't clear the cache or previous reels in the UI
      reelState.docId = docId;
    }

    reelRail.show();
    reelRail.setCooking(true);
    importDialog.setMinimized(true);
    importDialog.setButtonText('Upload another PDF or text');

    // Register this upload in the selector
    const uploadLabel = `Upload #${reelState.documentCount}`;
    reelRail.addUpload(docId, uploadLabel);

    let reelsReceived = 0;

    // Stream reels
    const cancelStream = streamReels(
      docId,
      (reel) => {
        reelsReceived++;
        reelRail.appendReel(reel, docId);

        // Auto-select first reel
        if (!reelState.activeReelId && reel.index === 0) {
          selectReel(reel, false);
        }
      },
      () => {
        // onDone callback
        reelRail.setCooking(false);
        if (reelsReceived === 0) {
          reelRail.setStatus('No reels were generated.');
        }
      }
    );

    reelRail.setLoading(false);
  } catch (error) {
    console.error(error);
    reelRail.show(); // Ensure it is visible to show the error
    reelRail.setStatus('Failed to process, please try again.');
    reelRail.setLoading(false);
    reelRail.setCooking(false);
  }
}

function resetReelState(docId: string): void {
  reelState.docId = docId;
  reelState.activeReelId = '';
  reelState.currentPage = null;
  reelCache.clear();
  reelRequests.clear();
}

async function requestReelPage(offset: number): Promise<ReelPage> {
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

function selectReel(reel: Reel, autoplay: boolean): void {
  // Apply background based on style
  if (activeStyle === 'cartoon') {
    // Pick a random cartoon background
    // This is simple randomization. Ideally we'd keep it consistent per reel or have a sub-selector.
    const cartoons = ['stickman', 'blobs', 'rain'];
    const randomId = cartoons[Math.floor(Math.random() * cartoons.length)];
    void background.setStyle(randomId);
  } else if (activeStyle === 'calming') {
    void background.setStyle(reel.backgroundId);
  }
  // 'real' mode falls through (or could have its own logic)

  const reelFrames = groupTokens(tokenize(reel.text), currentChunkSize);
  reader.setFrames(reelFrames, { preservePosition: false });
  if (autoplay) {
    reader.play();
  }
}
