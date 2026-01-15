export type ControlHandlers = {
  onPlayPause: () => void;
  onRestart: () => void;
  onRewind: () => void;
  onForward: () => void;
  onWpmChange: (wpm: number) => void;
  onChunkSizeChange: (size: number) => void;
};

function formatWordCount(size: number): string {
  return size === 1 ? '1 word' : `${size} words`;
}

function stepRange(input: HTMLInputElement, direction: 'up' | 'down'): void {
  if (direction === 'up') {
    input.stepUp();
  } else {
    input.stepDown();
  }
}

export class Controls {
  private root: HTMLElement;
  private playButton: HTMLButtonElement;
  private wpmInput: HTMLInputElement;
  private wpmValue: HTMLElement;
  private chunkInput: HTMLInputElement;
  private chunkValue: HTMLElement;
  private transport: HTMLElement;
  private sliders: HTMLElement;
  private handlers: Partial<ControlHandlers> = {};

  constructor(container: HTMLElement, initialWpm: number, initialChunkSize: number) {
    this.root = document.createElement('div');
    this.root.className = 'controls';

    this.transport = document.createElement('div');
    this.transport.className = 'controls-transport';

    const restartButton = document.createElement('button');
    restartButton.className = 'control-button';
    restartButton.type = 'button';
    restartButton.textContent = 'Restart';

    const rewindButton = document.createElement('button');
    rewindButton.className = 'control-button';
    rewindButton.type = 'button';
    rewindButton.textContent = 'Rewind';

    this.playButton = document.createElement('button');
    this.playButton.className = 'control-button control-primary';
    this.playButton.type = 'button';
    this.playButton.textContent = 'Play';

    const forwardButton = document.createElement('button');
    forwardButton.className = 'control-button';
    forwardButton.type = 'button';
    forwardButton.textContent = 'Forward';

    this.transport.append(restartButton, rewindButton, this.playButton, forwardButton);

    this.sliders = document.createElement('div');
    this.sliders.className = 'controls-sliders';

    const wpmWrap = document.createElement('div');
    wpmWrap.className = 'controls-slider';

    const wpmRow = document.createElement('div');
    wpmRow.className = 'controls-slider-row';

    const wpmMinus = document.createElement('button');
    wpmMinus.type = 'button';
    wpmMinus.className = 'control-button control-step';
    wpmMinus.textContent = '-';

    this.wpmInput = document.createElement('input');
    this.wpmInput.type = 'range';
    this.wpmInput.min = '150';
    this.wpmInput.max = '700';
    this.wpmInput.step = '25';
    this.wpmInput.value = String(initialWpm);

    const wpmPlus = document.createElement('button');
    wpmPlus.type = 'button';
    wpmPlus.className = 'control-button control-step';
    wpmPlus.textContent = '+';

    this.wpmValue = document.createElement('div');
    this.wpmValue.className = 'controls-wpm';
    this.wpmValue.textContent = `${initialWpm} WPM`;

    wpmRow.append(wpmMinus, this.wpmInput, wpmPlus);
    wpmWrap.append(wpmRow, this.wpmValue);

    const chunkWrap = document.createElement('div');
    chunkWrap.className = 'controls-slider';

    const chunkRow = document.createElement('div');
    chunkRow.className = 'controls-slider-row';

    const chunkMinus = document.createElement('button');
    chunkMinus.type = 'button';
    chunkMinus.className = 'control-button control-step';
    chunkMinus.textContent = '-';

    this.chunkInput = document.createElement('input');
    this.chunkInput.type = 'range';
    this.chunkInput.min = '1';
    this.chunkInput.max = '4';
    this.chunkInput.step = '1';
    this.chunkInput.value = String(initialChunkSize);

    const chunkPlus = document.createElement('button');
    chunkPlus.type = 'button';
    chunkPlus.className = 'control-button control-step';
    chunkPlus.textContent = '+';

    this.chunkValue = document.createElement('div');
    this.chunkValue.className = 'controls-chunk';
    this.chunkValue.textContent = formatWordCount(initialChunkSize);

    chunkRow.append(chunkMinus, this.chunkInput, chunkPlus);
    chunkWrap.append(chunkRow, this.chunkValue);

    this.sliders.append(wpmWrap, chunkWrap);

    this.root.append(this.transport, this.sliders);
    container.append(this.root);

    this.playButton.addEventListener('click', () => this.handlers.onPlayPause?.());
    restartButton.addEventListener('click', () => this.handlers.onRestart?.());
    rewindButton.addEventListener('click', () => this.handlers.onRewind?.());
    forwardButton.addEventListener('click', () => this.handlers.onForward?.());
    this.wpmInput.addEventListener('input', () => {
      this.updateWpm();
    });
    wpmMinus.addEventListener('click', () => {
      stepRange(this.wpmInput, 'down');
      this.updateWpm();
    });
    wpmPlus.addEventListener('click', () => {
      stepRange(this.wpmInput, 'up');
      this.updateWpm();
    });

    this.chunkInput.addEventListener('input', () => {
      this.updateChunkSize();
    });
    chunkMinus.addEventListener('click', () => {
      stepRange(this.chunkInput, 'down');
      this.updateChunkSize();
    });
    chunkPlus.addEventListener('click', () => {
      stepRange(this.chunkInput, 'up');
      this.updateChunkSize();
    });
  }

  bind(handlers: ControlHandlers): void {
    this.handlers = handlers;
  }

  setPlaying(isPlaying: boolean): void {
    this.playButton.textContent = isPlaying ? 'Pause' : 'Play';
  }

  setWpm(wpm: number): void {
    this.wpmInput.value = String(wpm);
    this.wpmValue.textContent = `${wpm} WPM`;
  }

  setChunkSize(size: number): void {
    this.chunkInput.value = String(size);
    this.chunkValue.textContent = formatWordCount(size);
  }

  // Removed setStyle


  getElement(): HTMLElement {
    return this.root;
  }

  getSlidersElement(): HTMLElement {
    return this.sliders;
  }

  private updateWpm(): void {
    const wpm = Number(this.wpmInput.value);
    this.wpmValue.textContent = `${wpm} WPM`;
    this.handlers.onWpmChange?.(wpm);
  }

  private updateChunkSize(): void {
    const size = Number(this.chunkInput.value);
    this.chunkValue.textContent = formatWordCount(size);
    this.handlers.onChunkSizeChange?.(size);
  }
}
