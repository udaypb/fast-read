export type SeekBarHandlers = {
  onSeek: (index: number) => void;
  onJump: (delta: number) => void;
};

export class SeekBar {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private label: HTMLElement;
  private handlers: Partial<SeekBarHandlers> = {};
  private totalFrames = 0;
  private isScrubbing = false;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'seek-bar';

    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.className = 'seek-bar-input';
    this.input.min = '0';
    this.input.max = '0';
    this.input.step = '1';
    this.input.value = '0';
    this.input.disabled = true;

    this.label = document.createElement('div');
    this.label.className = 'seek-bar-label';
    this.label.textContent = 'Frame 0 / 0';

    const transport = document.createElement('div');
    transport.className = 'seek-bar-transport';

    const rewindButton = document.createElement('button');
    rewindButton.type = 'button';
    rewindButton.className = 'control-button seek-bar-button';
    rewindButton.textContent = '<<';

    const forwardButton = document.createElement('button');
    forwardButton.type = 'button';
    forwardButton.className = 'control-button seek-bar-button';
    forwardButton.textContent = '>>';

    transport.append(rewindButton, forwardButton);

    this.root.append(this.input, this.label, transport);
    container.append(this.root);

    this.input.addEventListener('pointerdown', () => {
      this.isScrubbing = true;
    });
    this.input.addEventListener('pointerup', () => {
      this.isScrubbing = false;
    });
    this.input.addEventListener('touchend', () => {
      this.isScrubbing = false;
    });
    this.input.addEventListener('blur', () => {
      this.isScrubbing = false;
    });

    this.input.addEventListener('input', () => {
      const index = Number(this.input.value);
      this.updateLabel(index, this.totalFrames);
      this.handlers.onSeek?.(index);
    });

    rewindButton.addEventListener('click', () => {
      this.handlers.onJump?.(-this.getJumpStep());
    });
    forwardButton.addEventListener('click', () => {
      this.handlers.onJump?.(this.getJumpStep());
    });
  }

  bind(handlers: SeekBarHandlers): void {
    this.handlers = handlers;
  }

  setProgress(currentIndex: number, totalFrames: number): void {
    const safeTotal = Math.max(totalFrames, 0);
    const maxIndex = Math.max(safeTotal - 1, 0);
    const nextIndex = Math.min(Math.max(currentIndex, 0), maxIndex);

    this.totalFrames = safeTotal;
    this.input.max = String(maxIndex);
    this.input.disabled = safeTotal <= 1;

    if (!this.isScrubbing) {
      this.input.value = String(nextIndex);
      this.updateLabel(nextIndex, safeTotal);
    }
  }

  private updateLabel(currentIndex: number, totalFrames: number): void {
    if (totalFrames <= 0) {
      this.label.textContent = 'Frame 0 / 0';
      return;
    }
    this.label.textContent = `Frame ${currentIndex + 1} / ${totalFrames}`;
  }

  private getJumpStep(): number {
    return 1;
  }
}
