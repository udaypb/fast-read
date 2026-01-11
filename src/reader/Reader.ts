import type { Frame, ReaderState } from './types';

const DEFAULT_PUNCTUATION_DELAY = 0;
const MIN_WPM = 150;
const MAX_WPM = 700;

function punctuationDelay(text: string): number {
  if (/[.!?]$/.test(text)) return 250;
  if (/[,;:]$/.test(text)) return 150;
  return DEFAULT_PUNCTUATION_DELAY;
}

export type ReaderOptions = {
  frames: Frame[];
  wpm: number;
  onFrame: (frame: Frame, index: number) => void;
  onStateChange?: (state: ReaderState) => void;
};

export class Reader {
  private frames: Frame[];
  private state: ReaderState;
  private frameHandle: number | null = null;
  private nextFrameAt = 0;
  private onFrame: (frame: Frame, index: number) => void;
  private onStateChange?: (state: ReaderState) => void;

  constructor(options: ReaderOptions) {
    this.frames = options.frames;
    this.onFrame = options.onFrame;
    this.onStateChange = options.onStateChange;
    this.state = {
      isPlaying: false,
      currentIndex: 0,
      wpm: options.wpm,
      totalFrames: options.frames.length
    };
  }

  getState(): ReaderState {
    return { ...this.state };
  }

  play(): void {
    if (this.state.isPlaying || this.frames.length === 0) return;
    this.state.isPlaying = true;
    this.notifyState();
    this.emitFrame();
    this.scheduleNext();
  }

  pause(): void {
    if (!this.state.isPlaying) return;
    this.state.isPlaying = false;
    this.cancelFrame();
    this.notifyState();
  }

  toggle(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(delta: number): void {
    const nextIndex = Math.min(
      Math.max(this.state.currentIndex + delta, 0),
      Math.max(this.frames.length - 1, 0)
    );

    this.state.currentIndex = nextIndex;
    this.emitFrame();
    this.notifyState();

    if (this.state.isPlaying) {
      this.scheduleNext();
    }
  }

  setWpm(wpm: number): void {
    this.state.wpm = Math.min(Math.max(wpm, MIN_WPM), MAX_WPM);
    this.notifyState();

    if (this.state.isPlaying) {
      this.scheduleNext();
    }
  }

  setFrames(frames: Frame[], options?: { preservePosition?: boolean }): void {
    const preservePosition = options?.preservePosition ?? false;
    const currentTokenOffset = preservePosition ? this.getCurrentTokenOffset() : 0;
    const wasPlaying = this.state.isPlaying;

    this.frames = frames;
    this.state.totalFrames = frames.length;

    if (frames.length === 0) {
      this.state.currentIndex = 0;
      this.state.isPlaying = false;
      this.cancelFrame();
      this.emitFrame();
      this.notifyState();
      return;
    }

    this.state.currentIndex = preservePosition
      ? this.findFrameIndexForTokenOffset(currentTokenOffset, frames)
      : 0;
    this.emitFrame();
    this.notifyState();

    if (wasPlaying) {
      this.scheduleNext();
    }
  }

  private emitFrame(): void {
    const frame = this.frames[this.state.currentIndex];
    if (!frame) return;
    this.onFrame(frame, this.state.currentIndex);
  }

  private scheduleNext(): void {
    if (!this.state.isPlaying) return;
    const frame = this.frames[this.state.currentIndex];
    if (!frame) return;

    this.nextFrameAt = performance.now() + this.getFrameDuration(frame);
    this.cancelFrame();
    this.frameHandle = window.requestAnimationFrame(this.tick);
  }

  private tick = (timestamp: number): void => {
    if (!this.state.isPlaying) return;

    if (timestamp >= this.nextFrameAt) {
      if (this.state.currentIndex >= this.frames.length - 1) {
        this.pause();
        return;
      }

      this.state.currentIndex += 1;
      this.emitFrame();
      const nextFrame = this.frames[this.state.currentIndex];
      if (!nextFrame) {
        this.pause();
        return;
      }

      this.nextFrameAt = timestamp + this.getFrameDuration(nextFrame);
    }

    if (this.state.isPlaying) {
      this.frameHandle = window.requestAnimationFrame(this.tick);
    }
  };

  private getFrameDuration(frame: Frame): number {
    const baseMs = (60_000 / this.state.wpm) * frame.tokens.length;
    const extra = frame.tokens.reduce((maxDelay, token) => {
      return Math.max(maxDelay, punctuationDelay(token.text));
    }, 0);

    return baseMs + extra;
  }

  private notifyState(): void {
    this.onStateChange?.(this.getState());
  }

  private cancelFrame(): void {
    if (this.frameHandle !== null) {
      window.cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }

  private getCurrentTokenOffset(): number {
    let offset = 0;
    for (let i = 0; i < this.state.currentIndex; i += 1) {
      offset += this.frames[i]?.tokens.length ?? 0;
    }
    return offset;
  }

  private findFrameIndexForTokenOffset(offset: number, frames: Frame[]): number {
    let running = 0;
    for (let i = 0; i < frames.length; i += 1) {
      const length = frames[i].tokens.length;
      if (offset < running + length) return i;
      running += length;
    }
    return Math.max(frames.length - 1, 0);
  }
}
