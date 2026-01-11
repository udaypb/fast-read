import './styles/main.css';

import { groupTokens } from './reader/Grouper';
import { Reader } from './reader/Reader';
import { tokenize } from './reader/Tokenizer';
import { createDocFromFile, createDocFromText, getReelPage } from './api/client';
import type { Reel, ReelPage } from './api/types';
import { Background } from './ui/Background';
import { Controls } from './ui/Controls';
import { ImportDialog } from './ui/ImportDialog';
import { ReelRail } from './ui/ReelRail';
import { ReaderView } from './ui/ReaderView';
import { SeekBar } from './ui/SeekBar';

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

const seekBar = new SeekBar(controlsStack);
const controls = new Controls(controlsStack, DEFAULT_WPM, DEFAULT_CHUNK_SIZE);

const reader = new Reader({
  frames,
  wpm: DEFAULT_WPM,
  onFrame: (frame) => readerView.setFrame(frame),
  onStateChange: (state) => {
    controls.setPlaying(state.isPlaying);
    controls.setWpm(state.wpm);
    seekBar.setProgress(state.currentIndex, state.totalFrames);
  }
});

readerView.setFrame(frames[0] ?? null);
seekBar.setProgress(0, frames.length);

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
  currentPage: null as ReelPage | null
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
  reelRail.setStatus('Processing document...');
  reelRail.setLoading(true);
  try {
    const { docId } = await createDoc();
    resetReelState(docId);
    await loadReelPage(0, 'start');
  } catch (error) {
    console.error(error);
    reelRail.setStatus('Unable to process document.');
    reelRail.setLoading(false);
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
  activeText = reel.text;
  reelState.activeReelId = reel.reelId;
  reelRail.setActive(reel.reelId);
  void background.setStyle(reel.backgroundId);

  const reelFrames = groupTokens(tokenize(reel.text), currentChunkSize);
  reader.setFrames(reelFrames, { preservePosition: false });
  if (autoplay) {
    reader.play();
  }
}
