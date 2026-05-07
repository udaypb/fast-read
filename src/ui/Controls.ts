export type ControlHandlers = {
  onPlayPause: () => void;
  onRestart: () => void;
  onRewind: () => void;
  onForward: () => void;
  onWpmChange: (wpm: number) => void;
};

export class Controls {
  private root: HTMLElement;
  private playButton: HTMLButtonElement;
  private wpmInput: HTMLInputElement;
  private wpmValue: HTMLElement;
  private transport: HTMLElement;
  private sliders: HTMLElement;
  private cog: HTMLElement;
  private handlers: Partial<ControlHandlers> = {};

  constructor(container: HTMLElement, initialWpm: number) {
    this.root = document.createElement('div');
    this.root.className = 'controls';

    this.transport = document.createElement('div');
    this.transport.className = 'controls-transport';

    const restartButton = document.createElement('button');
    restartButton.className = 'control-button';
    restartButton.type = 'button';
    restartButton.textContent = '↺';
    restartButton.title = 'Restart';
    restartButton.setAttribute('aria-label', 'Restart');

    const rewindButton = document.createElement('button');
    rewindButton.className = 'control-button';
    rewindButton.type = 'button';
    rewindButton.textContent = '«';
    rewindButton.title = 'Rewind';
    rewindButton.setAttribute('aria-label', 'Rewind');

    this.playButton = document.createElement('button');
    this.playButton.className = 'control-button control-primary';
    this.playButton.type = 'button';
    this.playButton.textContent = '▶';
    this.playButton.title = 'Play / Pause';

    const forwardButton = document.createElement('button');
    forwardButton.className = 'control-button';
    forwardButton.type = 'button';
    forwardButton.textContent = '»';
    forwardButton.title = 'Forward';
    forwardButton.setAttribute('aria-label', 'Forward');

    this.transport.append(restartButton, rewindButton, this.playButton, forwardButton);

    this.sliders = document.createElement('div');
    this.sliders.className = 'controls-sliders';

    const wpmWrap = document.createElement('div');
    wpmWrap.className = 'controls-slider';

    this.wpmInput = document.createElement('input');
    this.wpmInput.type = 'range';
    this.wpmInput.className = 'controls-range-input';
    this.wpmInput.min = '150';
    this.wpmInput.max = '700';
    this.wpmInput.step = '25';
    this.wpmInput.value = String(initialWpm);

    this.wpmValue = document.createElement('div');
    this.wpmValue.className = 'controls-wpm';
    this.wpmValue.textContent = `${initialWpm} WPM`;

    const wpmHeader = document.createElement('div');
    wpmHeader.className = 'controls-slider-meta';

    const wpmLabel = document.createElement('div');
    wpmLabel.className = 'controls-slider-label';
    wpmLabel.textContent = 'Speed';

    wpmHeader.append(wpmLabel, this.wpmValue);

    const wpmShell = document.createElement('div');
    wpmShell.className = 'slider-shell';

    const wpmScale = document.createElement('div');
    wpmScale.className = 'slider-scale';
    wpmScale.innerHTML = '<span>Min</span><span>Mid</span><span>Max</span>';

    const wpmRow = document.createElement('div');
    wpmRow.className = 'controls-slider-row slider-row';
    wpmRow.append(this.wpmInput);

    wpmShell.append(wpmScale, wpmRow);
    wpmWrap.append(wpmHeader, wpmShell);

    this.sliders.append(wpmWrap);

    this.cog = document.createElement('div');
    this.cog.className = 'controls-cog';

    const cogIcon = document.createElement('span');
    cogIcon.className = 'controls-cog-icon';
    cogIcon.textContent = '⚙️';

    const cogArrow = document.createElement('span');
    cogArrow.className = 'controls-cog-arrow';
    cogArrow.textContent = 'v'; // Default collapsed

    this.cog.append(cogIcon, cogArrow);

    this.root.append(this.transport, this.sliders);
    container.append(this.root, this.cog);

    this.setFocusMode(false);

    this.cog.addEventListener('click', () => {
      const isCurrentlyFocused = document.body.classList.contains('focus-mode');
      this.setFocusMode(!isCurrentlyFocused);
    });
    this.playButton.addEventListener('click', () => this.handlers.onPlayPause?.());
    restartButton.addEventListener('click', () => this.handlers.onRestart?.());
    rewindButton.addEventListener('click', () => this.handlers.onRewind?.());
    forwardButton.addEventListener('click', () => this.handlers.onForward?.());
    this.wpmInput.addEventListener('input', () => {
      this.updateWpm();
    });
    this.setWpm(initialWpm);
  }

  bind(handlers: ControlHandlers): void {
    this.handlers = handlers;
  }

  setPlaying(isPlaying: boolean): void {
    this.playButton.textContent = isPlaying ? '⏸' : '▶';
  }

  setWpm(wpm: number): void {
    this.wpmInput.value = String(wpm);
    this.wpmValue.textContent = `${wpm} WPM`;
    const progress = ((wpm - 150) / (700 - 150)) * 100;
    this.wpmInput.style.setProperty('--slider-progress', `${progress}%`);
  }

  setFocusMode(enabled: boolean): void {
    document.body.classList.toggle('focus-mode', enabled);
    // When focus mode is NOT enabled, we are in "expanded" state from the cog's perspective
    document.body.classList.toggle('focus-mode-expanded', !enabled);

    const arrow = this.cog.querySelector('.controls-cog-arrow');
    if (arrow) {
      arrow.textContent = enabled ? 'v' : '^';
    }
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
}
