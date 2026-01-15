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

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'reel-rail';

    this.frame = document.createElement('div');
    this.frame.className = 'reel-rail-frame';

    this.track = document.createElement('div');
    this.track.className = 'reel-rail-track';
    this.track.tabIndex = 0;

    this.status = document.createElement('div');
    this.status.className = 'reel-rail-status';
    this.status.textContent = 'Loading reels…';

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
    this.root.append(this.frame);
    container.append(this.root);

    this.track.addEventListener('scroll', () => this.handleScroll());
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

  setReels(reels: Reel[], options?: { activeReelId?: string; align?: 'start' | 'end' }): void {
    this.track.innerHTML = '';
    reels.forEach((reel) => {
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
    });

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
      if (this.cookingCard) return; // Already cooking
      // Clear status message if it's the only thing there
      if (this.status.parentNode === this.track) {
        this.track.innerHTML = '';
      }

      this.cookingCard = document.createElement('div');
      this.cookingCard.className = 'reel-card-cooking';

      const icon = document.createElement('div');
      icon.className = 'cooking-icon';
      icon.textContent = '🍳'; // Simple egg in pan or similar

      const text = document.createElement('div');
      text.className = 'cooking-text';
      text.textContent = 'Cooking up reels...';

      this.cookingCard.append(icon, text);
      this.track.append(this.cookingCard);

      // Scroll into view if needed
      this.cookingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      if (this.cookingCard) {
        this.cookingCard.remove();
        this.cookingCard = null;
      }
    }
  }

  appendReel(reel: Reel): void {
    if (this.status.parentNode === this.track) {
      this.track.innerHTML = '';
    }

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

    // Insert before cooking card if it exists
    if (this.cookingCard && this.track.contains(this.cookingCard)) {
      this.track.insertBefore(card, this.cookingCard);
      // Auto-scroll to the new item or keep cooking in view?
      // User says "shift that animation to the right of each reel received"
      // implying the list grows to the left of the animation.
      // Usually better to keep the latest content visible or just append.
      // this.cookingCard.scrollIntoView({ behavior: 'smooth', inline: 'nearest' });
    } else {
      this.track.append(card);
    }

    if (this.activeId === reel.reelId) {
      card.classList.add('reel-card--active');
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
