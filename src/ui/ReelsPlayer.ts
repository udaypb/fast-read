import { gsap } from 'gsap';
import type { Frame } from '../reader/types';
import type { Reel, CharacterAsset, CharacterLine } from '../api/types';
import { Background } from './Background';
import { tokenize } from '../reader/Tokenizer';

export enum DisplayMode {
    Standard = 'standard',
    Portrait = 'portrait'
}

export class ReelsPlayer {
    private root: HTMLElement;
    private contentEl: HTMLElement;
    private playPauseBtn: HTMLButtonElement;
    private mode: DisplayMode = DisplayMode.Standard;
    private onPlayPause?: () => void;
    private onSeek?: (delta: number) => void;
    private isEmptyState = false;

    private loaderEl: HTMLElement;
    private loaderText: HTMLElement;
    private progressContainer: HTMLElement;
    private progressBar: HTMLElement;
    private frameCounter: HTMLElement;
    private playPauseIndicator: HTMLElement;

    private pager: HTMLElement;
    private screens: Map<string, ReelScreen> = new Map();
    private activeReelId: string | null = null;
    private observer: IntersectionObserver;
    private onActiveReelChange?: (reelId: string) => void;
    private onWpmChange?: (wpm: number) => void;
    private isInternalScroll = false;
    private _isDragging = false;
    private wpm = 250;
    private chunkControls: HTMLElement;
    private chunkValueEl: HTMLElement;
    private speedMinusBtn: HTMLButtonElement;
    private speedPlusBtn: HTMLButtonElement;
    private compactPlayBtn: HTMLButtonElement;
    private deleteBtn: HTMLButtonElement;
    private backgroundCycleControl: HTMLElement;
    private backgroundCycleBtn: HTMLButtonElement;
    private backgroundCycleLabel: HTMLElement;
    private onDelete?: () => void;
    private onCycleBackground?: () => void;
    private onPreviewExpandChange?: (expanded: boolean) => void;
    private expandedReelId: string | null = null;

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'reels-player-root';
        this.root.style.display = 'none'; // Hidden by default

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'reels-player-content';

        // this.textEl = document.createElement('div'); // Removed from ReelsPlayer
        // this.textEl.className = 'reels-player-text';
        // textEl is now part of ReelScreen, removed from ReelsPlayer directly
        // this.textEl = document.createElement('div');
        // this.textEl.className = 'reels-player-text';

        this.playPauseBtn = document.createElement('button');
        this.playPauseBtn.className = 'reels-play-pause-btn';
        this.playPauseBtn.append(this.createPlayIcon(false));
        this.playPauseBtn.style.display = 'none'; // Hidden in favor of Settings Panel controls

        // Loader
        this.loaderEl = document.createElement('div');
        this.loaderEl.className = 'reels-loader';
        const spinner = document.createElement('div');
        spinner.className = 'reels-spinner';
        this.loaderText = document.createElement('div');
        this.loaderText.className = 'reels-loader-text';
        this.loaderText.textContent = 'Processing text...';
        this.loaderEl.appendChild(spinner);
        this.loaderEl.appendChild(this.loaderText);

        // Append loader directly to contentEl
        this.contentEl.appendChild(this.loaderEl);

        // Pager container for vertical scrolling
        this.pager = document.createElement('div');
        this.pager.className = 'reels-pager';
        this.contentEl.appendChild(this.pager);

        // Global Overlays (stay fixed while pager scrolls)
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'reels-progress-container';
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'reels-progress-bar';
        this.progressContainer.appendChild(this.progressBar);

        this.frameCounter = document.createElement('div');
        this.frameCounter.className = 'reels-frame-counter';
        this.frameCounter.textContent = '0 / 0';

        this.playPauseIndicator = document.createElement('div');
        this.playPauseIndicator.className = 'reels-center-indicator';

        this.chunkControls = document.createElement('div');
        this.chunkControls.className = 'reels-chunk-controls';

        this.chunkValueEl = document.createElement('div');
        this.chunkValueEl.className = 'reels-chunk-value';
        this.chunkValueEl.textContent = `${this.wpm} WPM`;

        this.speedMinusBtn = this.createSpeedButton('minus');
        this.speedPlusBtn = this.createSpeedButton('plus');

        const speedStepper = document.createElement('div');
        speedStepper.className = 'reels-speed-stepper';
        speedStepper.setAttribute('aria-label', 'Reading speed');
        speedStepper.append(this.speedMinusBtn, this.chunkValueEl, this.speedPlusBtn);

        this.speedMinusBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.changeWpmBy(-25);
        });

        this.speedPlusBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.changeWpmBy(25);
        });

        this.compactPlayBtn = document.createElement('button');
        this.compactPlayBtn.type = 'button';
        this.compactPlayBtn.className = 'reels-compact-play-btn';
        this.compactPlayBtn.append(this.createPlayIcon(false));
        this.compactPlayBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.onPlayPause?.();
        });

        this.deleteBtn = document.createElement('button');
        this.deleteBtn.type = 'button';
        this.deleteBtn.className = 'reels-delete-btn reels-delete-btn--hidden';
        this.deleteBtn.innerHTML = '✕';
        this.deleteBtn.title = 'Delete reel group';
        this.deleteBtn.setAttribute('aria-label', 'Delete reel group');
        this.deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.onDelete?.();
        });

        this.backgroundCycleControl = document.createElement('div');
        this.backgroundCycleControl.className = 'reels-background-cycle reels-background-cycle--hidden';

        this.backgroundCycleBtn = document.createElement('button');
        this.backgroundCycleBtn.type = 'button';
        this.backgroundCycleBtn.className = 'reels-background-cycle-btn';
        this.backgroundCycleBtn.title = 'Change background';
        this.backgroundCycleBtn.setAttribute('aria-label', 'Change reel background');
        this.backgroundCycleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M18.4 3.5a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5a.75.75 0 0 1 .75-.75Z"/>
                <path d="M4.2 5.75a2.25 2.25 0 0 1 2.25-2.25h6.45a.75.75 0 0 1 0 1.5H6.45a.75.75 0 0 0-.75.75v10.5l3.12-3.13a1.75 1.75 0 0 1 2.48 0l1.45 1.45 2.15-2.15a1.75 1.75 0 0 1 2.48 0l.92.92V11a.75.75 0 0 1 1.5 0v7.25a2.25 2.25 0 0 1-2.25 2.25H6.45a2.25 2.25 0 0 1-2.25-2.25V5.75Zm1.55 12.68c.18.35.55.57.97.57h10.55c.34 0 .66-.16.86-.43l-1.8-1.8-2.15 2.15a1.75 1.75 0 0 1-2.48 0l-1.45-1.45-4.5 4.46Z"/>
                <path d="M8.35 7.9a1.35 1.35 0 1 1 2.7 0 1.35 1.35 0 0 1-2.7 0Z"/>
            </svg>
        `;
        this.backgroundCycleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.onCycleBackground?.();
        });

        this.backgroundCycleLabel = document.createElement('div');
        this.backgroundCycleLabel.className = 'reels-background-cycle-label';
        this.backgroundCycleControl.append(this.backgroundCycleBtn, this.backgroundCycleLabel);

        this.chunkControls.append(speedStepper);

        this.setWpm(this.wpm);

        this.contentEl.append(
            this.progressContainer,
            this.frameCounter,
            this.playPauseIndicator,
            this.deleteBtn,
            this.backgroundCycleControl,
            this.chunkControls,
            this.compactPlayBtn
        );

        this.initInteraction(this.pager);

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = (entry.target as HTMLElement).dataset.reelId;
                if (!id) return;
                const screen = this.screens.get(id);
                if (!screen) return;

                if (entry.isIntersecting) {
                    // Pre-warm background as soon as it enters
                    screen.activate();
                } else {
                    // Cleanup when definitely gone
                    screen.deactivate();
                }

                if (entry.intersectionRatio > 0.5 && id !== this.activeReelId && !this.isInternalScroll && !this._isDragging) {
                    this.activeReelId = id;
                    this.onActiveReelChange?.(id);
                }
            });
        }, { threshold: [0, 0.5] });

        this.root.appendChild(this.contentEl);
        container.appendChild(this.root);
    }

    setProgress(current: number, total: number): void {
        const percentage = total > 1 ? (current / (total - 1)) * 100 : 0;
        this.progressBar.style.width = `${percentage}%`;
        this.frameCounter.textContent = `${current + 1} / ${total}`;
    }

    setLoading(loading: boolean, text: string = 'Processing text...'): void {
        if (loading) {
            this.loaderText.textContent = text;
            this.loaderEl.classList.add('reels-loader--active');
        } else {
            this.loaderEl.classList.remove('reels-loader--active');
        }
    }

    updateStatus(_count: number, _isDone: boolean): void {
        // The status pill was intentionally removed; keep this method as a no-op
        // so processing flows can continue to report status without rendering UI.
    }
    // ... (keep existing methods up to playTransition)
    showEmptyState(show: boolean, options?: { message?: string }): void {
        this.isEmptyState = show;

        const emptyStateMessage = options?.message ?? '';

        if (show) {
            // Keep a placeholder screen so the background and pager layout stay stable.
            // This guards against edge cases where screens exist but no active screen is set.
            const activeScreen = this.activeReelId ? this.screens.get(this.activeReelId) : null;
            if (!activeScreen) {
                this.clearReels();
                const emptyReel = {
                    reelId: 'empty',
                    title: 'Empty',
                    text: emptyStateMessage,
                    index: 0,
                    wordCount: 0,
                    estDurationSec: 0,
                    backgroundId: 'intro'
                } as any;
                this.addReel(emptyReel);
                this.activeReelId = 'empty';
            }
        }

        if (show && this.screens.size === 0) {
            // Create a temporary empty screen so the background remains mounted.
            const emptyReel = {
                reelId: 'empty',
                title: 'Empty',
                text: emptyStateMessage,
                index: 0,
                wordCount: 0,
                estDurationSec: 0,
                backgroundId: 'intro'
            } as any;
            this.addReel(emptyReel);
            this.activeReelId = 'empty';
            const screen = this.screens.get('empty');
            if (screen) {
                screen.activate();
                screen.setTextContent(emptyStateMessage);
                screen.addTextClass('reels-player-text--empty');
            }
            return;
        }

        const activeScreen = this.activeReelId ? this.screens.get(this.activeReelId) : null;

        this.contentEl.classList.toggle('reels-empty-state', show);
        if (show) {
            this.compactPlayBtn.classList.remove('reels-compact-play-btn--ready');
            this.setBackgroundCycleState(null);
        }

        if (show) {
            if (activeScreen) {
                activeScreen.setTextContent(emptyStateMessage);
                activeScreen.addTextClass('reels-player-text--empty');
            }
            this.playPauseBtn.style.display = 'none';
        } else {
            if (activeScreen) {
                activeScreen.removeTextClass('reels-player-text--empty');
                // The actual text will be set by setFrame
            }
            this.playPauseBtn.style.display = 'flex';
        }
    }

    public setReelBackground(reelId: string, backgroundId: string): void {
        const screen = this.screens.get(reelId);
        if (screen) {
            screen.setBackgroundId(backgroundId);
        }
    }

    setFrame(frame: Frame | null): void {
        const activeScreen = this.activeReelId ? this.screens.get(this.activeReelId) : null;
        if (activeScreen) {
            activeScreen.setFrame(frame);
        }
    }

    public addReel(reel: Reel): void {
        if (this.screens.has(reel.reelId)) return;

        const screen = new ReelScreen(reel, (expanded) => {
            this.setExpandedPreview(reel.reelId, expanded);
        });
        this.screens.set(reel.reelId, screen);
        this.pager.appendChild(screen.getElement());
        this.observer.observe(screen.getElement());

        if (!this.activeReelId) {
            this.activeReelId = reel.reelId;
            screen.activate();
        }
    }

    public scrollToReel(reelId: string): void {
        const screen = this.screens.get(reelId);
        if (screen) {
            if (this.expandedReelId && this.expandedReelId !== reelId) {
                this.collapseExpandedPreview();
            }
            this.isInternalScroll = true;
            this.activeReelId = reelId;
            screen.getElement().scrollIntoView({ behavior: 'smooth' });
            // Let the observer handle activation/deactivation naturally as it scrolls
            setTimeout(() => { this.isInternalScroll = false; }, 800);
        }
    }

    public clearReels(): void {
        this.collapseExpandedPreview();
        this.screens.forEach(s => {
            this.observer.unobserve(s.getElement());
            s.deactivate();
        });
        this.pager.innerHTML = '';
        this.screens.clear();
        this.activeReelId = null;
    }

    setMode(mode: DisplayMode): void {
        this.mode = mode;
        this.root.className = `reels-player-root reels-player--${mode}`;

        if (mode === DisplayMode.Standard) {
            this.root.style.display = 'none';
        } else {
            this.root.style.display = 'flex';
        }
    }

    getMode(): DisplayMode {
        return this.mode;
    }

    getContentElement(): HTMLElement {
        return this.contentEl;
    }

    setPlaying(playing: boolean): void {
        this.playPauseBtn.replaceChildren(this.createPlayIcon(playing));
        this.compactPlayBtn.replaceChildren(this.createPlayIcon(playing));
        const hasPlayableReel = !this.isEmptyState && Boolean(this.activeReelId) && this.activeReelId !== 'empty';
        this.compactPlayBtn.classList.toggle('reels-compact-play-btn--ready', hasPlayableReel && !playing);
    }

    private createPlayIcon(playing: boolean): HTMLSpanElement {
        const icon = document.createElement('span');
        icon.className = playing ? 'reels-control-icon reels-control-icon--pause' : 'reels-control-icon reels-control-icon--play';
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    }

    public showPlayPauseIndicator(playing: boolean): void {
        this.playPauseIndicator.replaceChildren(this.createPlayIcon(!playing));

        // Use class trigger for animation
        this.playPauseIndicator.classList.remove('animate');
        // trigger reflow
        void this.playPauseIndicator.offsetWidth;
        this.playPauseIndicator.classList.add('animate');
    }

    private initInteraction(el: HTMLElement): void {
        let holdTimer: number | null = null;
        let holdInterval: number | null = null;
        let holdConfig = { delay: 400, initialInterval: 150, minInterval: 50 };

        let startY = 0;
        let startScrollTop = 0;
        let isDragging = false;
        let hasMovedSignificantValue = false;
        const dragThreshold = 5; // Low threshold for immediate response

        const startHold = (delta: number) => {
            if (hasMovedSignificantValue) return;
            let currentInterval = holdConfig.initialInterval;

            holdInterval = window.setInterval(() => {
                this.onSeek?.(delta);
                // Accelerate
                if (currentInterval > holdConfig.minInterval) {
                    currentInterval -= 10;
                    if (holdInterval !== null) {
                        window.clearInterval(holdInterval);
                        holdInterval = window.setInterval(() => {
                            this.onSeek?.(delta);
                        }, currentInterval);
                    }
                }
            }, currentInterval);
        };

        el.addEventListener('pointerdown', (e) => {
            if (this.isEmptyState) return;

            const target = e.target as HTMLElement | null;
            if (target?.closest('button, input, textarea, a, .reels-player-preview')) {
                return;
            }

            startY = e.clientY;
            startScrollTop = this.pager.scrollTop;
            this._isDragging = true;
            isDragging = true;
            hasMovedSignificantValue = false;

            el.setPointerCapture(e.pointerId);

            // Disable snap while dragging to prevent fight (on desktop/mouse)
            if (e.pointerType === 'mouse') {
                this.pager.style.scrollSnapType = 'none';
            }

            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isLeft = x < rect.width * 0.4;
            const isRight = x > rect.width * 0.6;

            if (isLeft || isRight) {
                const delta = isLeft ? -1 : 1;
                holdTimer = window.setTimeout(() => {
                    if (!hasMovedSignificantValue && isDragging) {
                        startHold(delta);
                    }
                }, holdConfig.delay);
            }
        });

        el.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const deltaY = e.clientY - startY;

            if (Math.abs(deltaY) > dragThreshold) {
                hasMovedSignificantValue = true;
                if (holdTimer) {
                    window.clearTimeout(holdTimer);
                    holdTimer = null;
                }
            }

            if (hasMovedSignificantValue) {
                // Execute immediately for responsiveness
                this.pager.scrollTop = startScrollTop - deltaY;
            }
        });

        const stopHold = (e: PointerEvent) => {
            if (!isDragging) return;
            isDragging = false;
            this._isDragging = false;

            // Restore snap
            this.pager.style.scrollSnapType = 'y mandatory';

            try {
                el.releasePointerCapture(e.pointerId);
            } catch (err) { }

            if (holdTimer !== null) {
                window.clearTimeout(holdTimer);
                holdTimer = null;
            }
            if (holdInterval !== null) {
                window.clearInterval(holdInterval);
                holdInterval = null;
            }

            if (!hasMovedSignificantValue) {
                // It was a tap
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const isLeft = x < rect.width * 0.4;
                const isRight = x > rect.width * 0.6;

                if (!isLeft && !isRight) {
                    this.onPlayPause?.();
                } else {
                    const delta = isLeft ? -1 : 1;
                    this.onSeek?.(delta);
                }
            }
        };

        el.addEventListener('pointerup', stopHold);
        el.addEventListener('pointercancel', stopHold);
        el.addEventListener('pointerleave', stopHold);
    }

    bind(handler: {
        onPlayPause?: () => void;
        onSeek?: (delta: number) => void;
        onWpmChange?: (wpm: number) => void;
        onActiveReelChange?: (reelId: string) => void;
        onDelete?: () => void;
        onCycleBackground?: () => void;
        onPreviewExpandChange?: (expanded: boolean) => void;
    }): void {
        this.onPlayPause = handler.onPlayPause;
        this.onSeek = handler.onSeek;
        this.onWpmChange = handler.onWpmChange;
        this.onActiveReelChange = handler.onActiveReelChange;
        this.onDelete = handler.onDelete;
        this.onCycleBackground = handler.onCycleBackground;
        this.onPreviewExpandChange = handler.onPreviewExpandChange;
    }

    setBackgroundCycleState(label: string | null): void {
        const hidden = !label;
        this.backgroundCycleControl.classList.toggle('reels-background-cycle--hidden', hidden);
        this.backgroundCycleBtn.disabled = hidden;
        this.backgroundCycleLabel.textContent = label ? this.formatBackgroundLabel(label) : '';
        this.backgroundCycleLabel.title = label ?? '';
    }

    private formatBackgroundLabel(label: string): string {
        const trimmed = label.trim();
        if (trimmed.length <= 14) return trimmed;
        return `....${trimmed.slice(-10)}`;
    }

    private createSpeedButton(direction: 'minus' | 'plus'): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `reels-speed-stepper-btn reels-speed-stepper-btn--${direction}`;
        btn.setAttribute('aria-label', direction === 'minus' ? 'Decrease reading speed' : 'Increase reading speed');
        btn.textContent = direction === 'minus' ? '-' : '+';
        return btn;
    }

    private changeWpmBy(delta: number): void {
        const next = Math.max(150, Math.min(700, this.wpm + delta));
        if (next === this.wpm) return;

        this.setWpm(next);
        this.onWpmChange?.(next);
    }

    setWpm(wpm: number): void {
        this.wpm = Math.max(150, Math.min(700, wpm));
        this.chunkValueEl.textContent = `${this.wpm} WPM`;
        this.speedMinusBtn.disabled = this.wpm <= 150;
        this.speedPlusBtn.disabled = this.wpm >= 700;
    }

    setDeleteEnabled(enabled: boolean): void {
        this.deleteBtn.disabled = !enabled;
        this.deleteBtn.classList.toggle('reels-delete-btn--hidden', !enabled);
    }

    async playTransition(direction: 'next' | 'prev', updateState: () => void | Promise<void>): Promise<void> {
        // No longer used, handled by native scroll
        await updateState();
    }

    private collapseExpandedPreview(): void {
        if (!this.expandedReelId) {
            return;
        }

        const expandedScreen = this.screens.get(this.expandedReelId);
        this.expandedReelId = null;
        expandedScreen?.setExpanded(false);
        this.contentEl.classList.remove('reels-player-content--preview-expanded');
        this.pager.style.overflowY = 'scroll';
        this.onPreviewExpandChange?.(false);
    }

    private setExpandedPreview(reelId: string, expanded: boolean): void {
        if (!expanded) {
            if (this.expandedReelId !== reelId) {
                return;
            }
            this.expandedReelId = null;
            this.contentEl.classList.remove('reels-player-content--preview-expanded');
            this.pager.style.overflowY = 'scroll';
            this.onPreviewExpandChange?.(false);
            return;
        }

        if (this.expandedReelId && this.expandedReelId !== reelId) {
            this.screens.get(this.expandedReelId)?.setExpanded(false);
        }

        this.expandedReelId = reelId;
        this.contentEl.classList.add('reels-player-content--preview-expanded');
        this.pager.style.overflowY = 'hidden';
        this.onPreviewExpandChange?.(true);
    }
}

class ReelScreen {
    private root: HTMLElement;
    private titleRowEl: HTMLElement;
    private titleEl: HTMLElement;
    private expandBtn: HTMLButtonElement;
    private textWindow: HTMLElement;
    private textClipEl: HTMLElement;
    private textEl: HTMLElement;
    private playedProgressEl: HTMLElement;
    private playedProgressFillEl: HTMLElement;
    private previewEl: HTMLElement;
    private previewTokenEls: HTMLElement[] = [];
    private resizeObserver: ResizeObserver;
    private characterOverlay: HTMLElement;
    private characterImage: HTMLImageElement;
    private backgroundContainer: HTMLElement;
    private background: Background;
    private reel: Reel;
    private characterAssetMap: Map<string, CharacterAsset> = new Map();
    private isExpanded = false;
    private onExpandedChange?: (expanded: boolean) => void;

    constructor(reel: Reel, onExpandedChange?: (expanded: boolean) => void) {
        this.reel = reel;
        this.onExpandedChange = onExpandedChange;
        this.root = document.createElement('div');
        this.root.className = 'reel-screen';
        this.root.dataset.reelId = reel.reelId;

        this.backgroundContainer = document.createElement('div');
        this.backgroundContainer.className = 'reel-screen-background';

        this.background = new Background(this.backgroundContainer);

        this.textWindow = document.createElement('div');
        this.textWindow.className = 'reels-player-reader-window';

        this.titleRowEl = document.createElement('div');
        this.titleRowEl.className = 'reels-player-title-row';

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'reels-player-title';
        this.titleEl.textContent = reel.reelId === 'empty' ? '' : reel.title;

        this.expandBtn = document.createElement('button');
        this.expandBtn.type = 'button';
        this.expandBtn.className = 'reels-player-expand-btn';
        this.expandBtn.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });
        this.expandBtn.addEventListener('pointerup', (event) => {
            event.stopPropagation();
        });
        this.expandBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.setExpanded(!this.isExpanded);
        });

        this.titleRowEl.append(this.titleEl);

        const topBar = document.createElement('div');
        topBar.className = 'reels-player-bar reels-player-bar-top';

        const bottomBar = document.createElement('div');
        bottomBar.className = 'reels-player-bar reels-player-bar-bottom';

        this.playedProgressEl = document.createElement('div');
        this.playedProgressEl.className = 'reels-player-text-progress';
        this.playedProgressEl.setAttribute('role', 'progressbar');
        this.playedProgressEl.setAttribute('aria-label', 'Reel text played');
        this.playedProgressEl.setAttribute('aria-valuemin', '0');
        this.playedProgressEl.setAttribute('aria-valuemax', '100');
        this.playedProgressEl.setAttribute('aria-valuenow', '0');

        this.playedProgressFillEl = document.createElement('div');
        this.playedProgressFillEl.className = 'reels-player-text-progress-fill';
        this.playedProgressEl.append(this.playedProgressFillEl);

        this.textClipEl = document.createElement('div');
        this.textClipEl.className = 'reels-player-text-clip';

        this.textEl = document.createElement('div');
        this.textEl.className = 'reels-player-text';
        this.textEl.textContent = ''; // Will be updated by reader

        this.previewEl = document.createElement('div');
        this.previewEl.className = 'reels-player-preview';
        const stopPagerPropagation = (event: Event) => {
            if (!this.isExpanded) return;
            event.stopPropagation();
        };
        this.previewEl.addEventListener('pointerdown', stopPagerPropagation);
        this.previewEl.addEventListener('wheel', stopPagerPropagation, { passive: true });
        this.previewEl.addEventListener('touchstart', stopPagerPropagation, { passive: true });
        this.previewEl.addEventListener('touchmove', stopPagerPropagation, { passive: true });

        // Header row: holds the expand button so it pushes content down, no overlapping.
        const windowHeader = document.createElement('div');
        windowHeader.className = 'reels-player-window-header';
        windowHeader.append(this.expandBtn);

        this.textClipEl.append(this.textEl);
        this.textWindow.append(topBar, windowHeader, this.textClipEl, this.previewEl, bottomBar, this.playedProgressEl);

        this.characterOverlay = document.createElement('div');
        this.characterOverlay.className = 'reel-character-overlay';

        this.characterImage = document.createElement('img');
        this.characterImage.className = 'reel-character-image';
        this.characterImage.alt = '';
        this.characterImage.loading = 'lazy';
        this.characterOverlay.append(this.characterImage);

        this.refreshCharacterAssets();
        this.renderPreviewTokens(reel.text);
        this.updateExpandButton();

        this.root.append(this.backgroundContainer, this.characterOverlay, this.titleRowEl, this.textWindow);

        this.resizeObserver = new ResizeObserver(() => {
            this.fitTextToWindow();
        });
        this.resizeObserver.observe(this.textClipEl);
    }

    getElement(): HTMLElement {
        return this.root;
    }

    getBackgroundContainer(): HTMLElement {
        return this.backgroundContainer;
    }

    activate(): void {
        const styleId = (this.reel.reelId === 'empty')
            ? 'intro'
            : (this.reel.backgroundId || 'net');
        this.background.start(styleId);
    }

    setBackgroundId(backgroundId: string): void {
        this.reel = {
            ...this.reel,
            backgroundId
        };
        this.activate();
    }

    deactivate(): void {
        this.background.stop();
    }

    setFrame(frame: Frame | null): void {
        if (!frame) {
            this.textEl.textContent = '';
            this.updatePreviewHighlight(null);
            this.updatePlayedProgress(null);
            this.clearCharacter();
            return;
        }
        this.textEl.textContent = frame.tokens.map((token) => token.text).join(' ');
        this.fitTextToWindow();
        this.updatePreviewHighlight(frame);
        this.updatePlayedProgress(frame);

        this.updateCharacterFromFrame(frame);
    }

    setTextContent(text: string): void {
        this.textEl.textContent = text;
        this.renderPreviewTokens(text);
        this.updatePlayedProgress(null);
        this.fitTextToWindow();
    }

    setTitle(title: string): void {
        this.titleEl.textContent = title;
    }

    addTextClass(className: string): void {
        this.textEl.classList.add(className);
    }

    removeTextClass(className: string): void {
        this.textEl.classList.remove(className);
    }

    setExpanded(expanded: boolean): void {
        if (this.reel.reelId === 'empty') {
            return;
        }

        this.isExpanded = expanded;
        this.root.classList.toggle('reel-screen--expanded', expanded);
        if (expanded) {
            this.previewEl.scrollTop = 0;
        }
        this.updateExpandButton();
        this.onExpandedChange?.(expanded);
    }

    private refreshCharacterAssets(): void {
        this.characterAssetMap.clear();
        (this.reel.characterAssets ?? []).forEach((asset) => {
            if (asset?.id) {
                this.characterAssetMap.set(asset.id, asset);
            }
        });
    }

    private resolveCharacterLine(frame: Frame): CharacterLine | null {
        if (!frame.characterId || !this.reel.characterScript?.length) return null;
        const match = this.reel.characterScript.find((line) => line.characterId === frame.characterId);
        return match ?? null;
    }

    private updateCharacterFromFrame(frame: Frame): void {
        if (!frame.characterId) {
            this.clearCharacter();
            return;
        }

        const line = this.resolveCharacterLine(frame);
        const asset = this.characterAssetMap.get(frame.characterId);
        const assetUri = frame.characterAssetUri || line?.assetUri || asset?.uri;
        const side = frame.characterSide || line?.side || asset?.side || 'left';

        if (!assetUri) {
            this.clearCharacter();
            return;
        }

        this.characterOverlay.dataset.side = side;
        this.characterImage.src = assetUri;
        this.characterOverlay.classList.add('reel-character-overlay--active');
    }

    private clearCharacter(): void {
        this.characterOverlay.classList.remove('reel-character-overlay--active');
        this.characterOverlay.dataset.side = '';
        this.characterImage.removeAttribute('src');
    }

    private updateExpandButton(): void {
        this.expandBtn.textContent = this.isExpanded ? 'Collapse' : 'Expand';
        this.expandBtn.setAttribute('aria-label', this.isExpanded ? 'Collapse text preview' : 'Expand text preview');
        this.expandBtn.classList.toggle('reels-player-expand-btn--hidden', this.reel.reelId === 'empty');
    }

    private renderPreviewTokens(text: string): void {
        this.previewEl.innerHTML = '';
        this.previewTokenEls = [];

        const tokens = tokenize(text);
        tokens.forEach((token, index) => {
            const tokenEl = document.createElement('span');
            tokenEl.className = 'reels-player-preview-token';
            tokenEl.textContent = token.text;
            this.previewTokenEls.push(tokenEl);
            this.previewEl.appendChild(tokenEl);

            if (index < tokens.length - 1) {
                this.previewEl.appendChild(document.createTextNode(' '));
            }
        });
    }

    private updatePreviewHighlight(frame: Frame | null): void {
        let activeTokenIndex = -1;

        this.previewTokenEls.forEach((tokenEl, index) => {
            const isActive = frame
                ? index >= frame.startTokenIndex && index <= frame.endTokenIndex
                : false;
            tokenEl.classList.toggle('reels-player-preview-token--active', isActive);
            if (isActive && activeTokenIndex < 0) {
                activeTokenIndex = index;
            }
        });

        const activeTokenEl = activeTokenIndex >= 0 ? this.previewTokenEls[activeTokenIndex] : null;
        if (this.isExpanded && activeTokenEl) {
            activeTokenEl.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }

    private updatePlayedProgress(frame: Frame | null): void {
        const totalTokens = this.previewTokenEls.length;
        const playedTokens = frame ? Math.min(frame.endTokenIndex + 1, totalTokens) : 0;
        const percentage = totalTokens > 0 ? Math.max(0, Math.min(100, (playedTokens / totalTokens) * 100)) : 0;
        const roundedPercentage = Math.round(percentage);

        this.playedProgressFillEl.style.width = `${percentage}%`;
        this.playedProgressEl.setAttribute('aria-valuenow', String(roundedPercentage));
        this.playedProgressEl.title = `${roundedPercentage}% played`;
    }

    private fitTextToWindow(): void {
        this.textEl.style.fontSize = '';

        const availableWidth = this.textClipEl.clientWidth - 8;
        if (!availableWidth) return;

        const baseSize = Number.parseFloat(window.getComputedStyle(this.textEl).fontSize);
        if (!Number.isFinite(baseSize) || baseSize <= 0) return;

        let nextSize = baseSize;
        let renderedWidth = this.textEl.scrollWidth;

        while (renderedWidth > availableWidth && nextSize > 16) {
            nextSize -= 1;
            this.textEl.style.fontSize = `${nextSize}px`;
            renderedWidth = this.textEl.scrollWidth;
        }
    }
}
