import type { Frame } from '../reader/types';

export class ReaderView {
  private root: HTMLElement;
  private textEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'reader';

    const windowEl = document.createElement('div');
    windowEl.className = 'reader-window';

    const topBar = document.createElement('div');
    topBar.className = 'reader-bar reader-bar-top';

    const bottomBar = document.createElement('div');
    bottomBar.className = 'reader-bar reader-bar-bottom';

    this.textEl = document.createElement('div');
    this.textEl.className = 'reader-text';

    windowEl.append(topBar, this.textEl, bottomBar);
    this.root.append(windowEl);
    container.append(this.root);
  }

  setFrame(frame: Frame | null): void {
    this.textEl.textContent = frame ? frame.text : '';
  }
}
