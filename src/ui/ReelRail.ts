import type { Reel } from '../api/types';

export type ReelRailHandlers = {
  onSelect: (reel: Reel) => void;
  onRequestPage: (direction: 'next' | 'prev') => void;
  onUploadChange?: (uploadId: string) => void;
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
  private currentUploadId: string | null = null;
  private uploadMap = new Map<string, Reel[]>();
  private uploadOrder: string[] = [];
  private uploadLabels = new Map<string, string>();
  private cookingUploadId: string | null = null;
  private statusMessage = 'Upload a document...';

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
    this.root.append(this.frame);
    container.append(this.root);

    this.track.addEventListener('scroll', () => this.handleScroll());
  }

  addUpload(uploadId: string, label: string, options?: { select?: boolean }): void {
    if (!this.uploadOrder.includes(uploadId)) {
      this.uploadOrder.push(uploadId);
    }
    this.uploadLabels.set(uploadId, label);
    if (!this.uploadMap.has(uploadId)) {
      this.uploadMap.set(uploadId, []);
    }

    if (!this.currentUploadId || options?.select) {
      this.currentUploadId = uploadId;
    }
    this.renderTrack();
  }

  private renderTrack(): void {
    this.track.innerHTML = '';
    this.renderSelector();
    let hasVisibleContent = false;

    this.uploadOrder.forEach((uploadId) => {
      const reels = this.uploadMap.get(uploadId) || [];
      const isCooking = this.cookingUploadId === uploadId;
      if (reels.length === 0 && !isCooking) {
        return;
      }

      hasVisibleContent = true;
      const group = document.createElement('section');
      group.className = 'reel-group';
      if (this.currentUploadId === uploadId) {
        group.classList.add('reel-group--active');
      }

      const label = document.createElement('div');
      label.className = 'reel-group-label';
      if (this.currentUploadId === uploadId) {
        label.classList.add('reel-group-label--active');
      }
      label.textContent = this.uploadLabels.get(uploadId) || 'Upload';
      group.append(label);

      const cards = document.createElement('div');
      cards.className = 'reel-group-cards';
      reels.forEach((reel) => this.createCard(reel, uploadId, cards));

      if (isCooking) {
        cards.append(this.createCookingCard());
      }

      group.append(cards);
      this.track.append(group);
    });

    if (!hasVisibleContent) {
      this.status.textContent = this.statusMessage;
      this.track.append(this.status);
      return;
    }

    if (this.activeId) {
      this.setActive(this.activeId);
    }
  }

  private renderSelector(): void {
    // Group switching is handled by the custom sheet menu.
  }

  private createCard(reel: Reel, uploadId: string, parent: HTMLElement): void {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'reel-card';
    card.dataset.reelId = reel.reelId;
    card.dataset.uploadId = uploadId;

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
    card.addEventListener('click', () => {
      this.currentUploadId = uploadId;
      this.handlers.onUploadChange?.(uploadId);
      this.handlers.onSelect?.(reel);
    });
    parent.append(card);
  }

  private createCookingCard(): HTMLElement {
    const cookingCard = document.createElement('div');
    cookingCard.className = 'reel-card-cooking';

    const icon = document.createElement('div');
    icon.className = 'cooking-icon';
    icon.textContent = '🍳';

    const text = document.createElement('div');
    text.className = 'cooking-text';
    text.textContent = 'Cooking up reels...';

    cookingCard.append(icon, text);
    return cookingCard;
  }

  bind(handlers: ReelRailHandlers): void {
    this.handlers = handlers;
  }

  setUploads(
    uploads: Array<{ uploadId: string; label: string; reels: Reel[] }>,
    options?: { currentUploadId?: string; activeReelId?: string | null }
  ): void {
    this.uploadMap.clear();
    this.uploadOrder = [];
    this.uploadLabels.clear();

    uploads.forEach(({ uploadId, label, reels }) => {
      this.uploadOrder.push(uploadId);
      this.uploadLabels.set(uploadId, label);
      this.uploadMap.set(uploadId, reels);
    });

    this.currentUploadId =
      options?.currentUploadId && this.uploadMap.has(options.currentUploadId)
        ? options.currentUploadId
        : this.uploadOrder[0] ?? null;
    this.activeId = options?.activeReelId ?? null;
    this.renderTrack();

    if (this.activeId) this.setActive(this.activeId);
  }

  setCurrentUpload(uploadId: string): void {
    if (!this.uploadMap.has(uploadId)) return;
    this.currentUploadId = uploadId;
    this.renderTrack();
  }

  setLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
    this.root.classList.toggle('reel-rail--loading', isLoading);
  }

  setStatus(message: string): void {
    this.statusMessage = message;
    this.renderTrack();
  }

  setReels(reels: Reel[], options?: { activeReelId?: string; align?: 'start' | 'end'; uploadId?: string }): void {
    const uploadId = options?.uploadId || this.currentUploadId;
    if (uploadId) {
      this.uploadMap.set(uploadId, reels);
      this.renderTrack();
    } else {
      this.renderTrack();
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

  setCooking(isCooking: boolean): void {
    this.cookingUploadId = isCooking ? this.currentUploadId : null;
    this.renderTrack();
    if (isCooking) {
      this.track.scrollLeft = this.track.scrollWidth;
    }
  }

  appendReel(reel: Reel, uploadId?: string): void {
    const id = uploadId || this.currentUploadId;
    if (!id) return;

    const uploadReels = this.uploadMap.get(id) || [];
    uploadReels.push(reel);
    this.uploadMap.set(id, uploadReels);
    this.renderTrack();
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
