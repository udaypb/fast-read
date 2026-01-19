import type { Reel } from '../api/types';

export type ReelRailHandlers = {
  onSelect: (reel: Reel) => void;
  onRequestPage: (direction: 'next' | 'prev') => void;
};

export class ReelRail {
  private root: HTMLElement;
  private frame: HTMLElement;
  private track: HTMLElement;
  private status: HTMLElement;
  private handlers: Partial<ReelRailHandlers> = {};
  private isLoading = false;
  private activeId: string | null = null;
  private scrollTimeout: number | null = null;
  private fadeLeft: HTMLElement;
  private fadeRight: HTMLElement;
  private selector: HTMLSelectElement;
  private currentUploadId: string | null = null;
  private uploadMap = new Map<string, Reel[]>();

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'reel-rail';

    this.selector = document.createElement('select');
    this.selector.className = 'reel-rail-selector';
    this.selector.style.display = 'none';
    this.selector.addEventListener('change', () => {
      this.switchUpload(this.selector.value);
    });

    this.frame = document.createElement('div');
    this.frame.className = 'reel-rail-frame';

    this.track = document.createElement('div');
    this.track.className = 'reel-rail-track';
    this.track.tabIndex = 0;

    this.status = document.createElement('div');
    this.status.className = 'reel-rail-status';
    this.status.textContent = 'Upload a document...';

    const lineTop = document.createElement('div');
    lineTop.className = 'reel-rail-line reel-rail-line-top';

    const lineBottom = document.createElement('div');
    lineBottom.className = 'reel-rail-line reel-rail-line-bottom';

    this.fadeLeft = document.createElement('div');
    this.fadeLeft.className = 'reel-rail-fade reel-rail-fade-left';
    const leftLine = document.createElement('div');
    leftLine.className = 'reel-rail-fade-line';
    this.fadeLeft.append(leftLine);

    this.fadeRight = document.createElement('div');
    this.fadeRight.className = 'reel-rail-fade reel-rail-fade-right';
    const rightLine = document.createElement('div');
    rightLine.className = 'reel-rail-fade-line';
    this.fadeRight.append(rightLine);

    this.track.append(this.status);
    this.frame.append(lineTop, lineBottom, this.track, this.fadeLeft, this.fadeRight);
    this.root.append(this.selector, this.frame);
    container.append(this.root);

    this.track.addEventListener('scroll', () => this.handleScroll());
  }

  addUpload(uploadId: string, label: string): void {
    const exists = Array.from(this.selector.options).some(o => o.value === uploadId);
    if (exists) return;

    const option = document.createElement('option');
    option.value = uploadId;
    option.textContent = label;
    this.selector.append(option);
    this.selector.style.display = 'block';

    if (!this.currentUploadId) {
      this.currentUploadId = uploadId;
      this.selector.value = uploadId;
    }

    if (!this.uploadMap.has(uploadId)) {
      this.uploadMap.set(uploadId, []);
    }
  }

  private switchUpload(uploadId: string): void {
    this.currentUploadId = uploadId;
    const reels = this.uploadMap.get(uploadId) || [];
    this.renderTrack(reels);
  }

  private renderTrack(reels: Reel[]): void {
    this.track.innerHTML = '';
    if (reels.length === 0) {
      this.track.append(this.status);
      return;
    }
    reels.forEach(r => this.createCard(r));
    if (this.activeId) {
      this.setActive(this.activeId);
    }
  }

  private createCard(reel: Reel): void {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'reel-card';
    card.dataset.reelId = reel.reelId;

    const title = document.createElement('div');
    title.className = 'reel-card-title';
    title.textContent = reel.title;

    const snippet = document.createElement('div');
    snippet.className = 'reel-card-snippet';
    snippet.textContent = formatSnippet(reel.text);

    const meta = document.createElement('div');
    meta.className = 'reel-card-meta';
    meta.textContent = `${formatDuration(reel.estDurationSec)} · ${reel.wordCount} words`;

    card.append(title, snippet, meta);
    card.addEventListener('click', () => this.handlers.onSelect?.(reel));
    this.track.append(card);
  }

  bind(handlers: ReelRailHandlers): void {
    this.handlers = handlers;
  }

  setLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
    this.root.classList.toggle('reel-rail--loading', isLoading);
  }

  setStatus(message: string): void {
    this.track.innerHTML = '';
    this.status.textContent = message;
    this.track.append(this.status);
    this.frame.append(this.fadeLeft, this.fadeRight);
  }

  setReels(reels: Reel[], options?: { activeReelId?: string; align?: 'start' | 'end'; uploadId?: string }): void {
    const uploadId = options?.uploadId || this.currentUploadId;
    if (uploadId) {
      this.uploadMap.set(uploadId, reels);
      if (uploadId === this.currentUploadId) {
        this.renderTrack(reels);
      }
    } else {
      this.renderTrack(reels);
    }

    if (options?.activeReelId) {
      this.setActive(options.activeReelId);
    } else {
      this.activeId = null;
    }

    if (options?.align === 'end') {
      this.track.scrollLeft = this.track.scrollWidth;
    } else {
      this.track.scrollLeft = 0;
    }
  }

  private cookingCard: HTMLElement | null = null;

  setCooking(isCooking: boolean): void {
    if (isCooking) {
      if (this.cookingCard) return;
      if (this.status.parentNode === this.track) {
        this.track.innerHTML = '';
      }
      this.cookingCard = document.createElement('div');
      this.cookingCard.className = 'reel-card-cooking';
      const icon = document.createElement('div');
      icon.className = 'cooking-icon';
      icon.textContent = '🍳';
      const text = document.createElement('div');
      text.className = 'cooking-text';
      text.textContent = 'Cooking up reels...';
      this.cookingCard.append(icon, text);
      this.track.append(this.cookingCard);
      this.cookingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      if (this.cookingCard) {
        this.cookingCard.remove();
        this.cookingCard = null;
      }
    }
  }

  appendReel(reel: Reel, uploadId?: string): void {
    const id = uploadId || this.currentUploadId;
    if (!id) return;

    let uploadReels = this.uploadMap.get(id) || [];
    uploadReels.push(reel);
    this.uploadMap.set(id, uploadReels);

    if (id === this.currentUploadId) {
      if (this.status.parentNode === this.track) {
        this.track.innerHTML = '';
      }
      this.createCard(reel);
    }
  }

  setActive(reelId: string): void {
    this.activeId = reelId;
    const cards = Array.from(this.track.querySelectorAll<HTMLElement>('.reel-card'));
    cards.forEach((card) => {
      const isActive = card.dataset.reelId === reelId;
      card.classList.toggle('reel-card--active', isActive);
    });
  }

  hide(): void {
    this.root.classList.add('reel-rail--hidden');
  }

  show(): void {
    this.root.classList.remove('reel-rail--hidden');
  }

  private handleScroll(): void {
    if (this.scrollTimeout !== null) {
      window.clearTimeout(this.scrollTimeout);
    }

    this.scrollTimeout = window.setTimeout(() => {
      if (this.isLoading) return;
      const maxScroll = this.track.scrollWidth - this.track.clientWidth;
      if (maxScroll <= 0) return;

      if (this.track.scrollLeft <= 24) {
        this.handlers.onRequestPage?.('prev');
      } else if (this.track.scrollLeft >= maxScroll - 24) {
        this.handlers.onRequestPage?.('next');
      }
    }, 120);
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatSnippet(text: string): string {
  const words = text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
  const slice = words.slice(0, 12);
  const snippet = slice.join(' ');
  return words.length > slice.length ? `${snippet}…` : snippet;
}
