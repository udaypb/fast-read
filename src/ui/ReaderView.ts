import type { Frame } from '../reader/types';

export class ReaderView {
  private root: HTMLElement;
  private textClipEl: HTMLElement;
  private textEl: HTMLElement;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'reader';

    const windowEl = document.createElement('div');
    windowEl.className = 'reader-window';

    const topBar = document.createElement('div');
    topBar.className = 'reader-bar reader-bar-top';

    const bottomBar = document.createElement('div');
    bottomBar.className = 'reader-bar reader-bar-bottom';

    this.textClipEl = document.createElement('div');
    this.textClipEl.className = 'reader-text-clip';

    this.textEl = document.createElement('div');
    this.textEl.className = 'reader-text';

    this.textClipEl.append(this.textEl);
    windowEl.append(topBar, this.textClipEl, bottomBar);
    this.root.append(windowEl);
    container.append(this.root);

    this.resizeObserver = new ResizeObserver(() => {
      this.fitTextToWindow();
    });
    this.resizeObserver.observe(this.textClipEl);
  }

  setFrame(frame: Frame | null): void {
    this.textEl.textContent = frame ? frame.tokens.map((token) => token.text).join(' ') : '';
    this.fitTextToWindow();
  }

  private fitTextToWindow(): void {
    this.textEl.style.fontSize = '';

    const availableWidth = this.textClipEl.clientWidth - 8;
    if (!availableWidth) return;

    const baseSize = Number.parseFloat(window.getComputedStyle(this.textEl).fontSize);
    if (!Number.isFinite(baseSize) || baseSize <= 0) return;

    let nextSize = baseSize;
    let renderedWidth = this.textEl.scrollWidth;

    while (renderedWidth > availableWidth && nextSize > 18) {
      nextSize -= 1;
      this.textEl.style.fontSize = `${nextSize}px`;
      renderedWidth = this.textEl.scrollWidth;
    }
  }
}
