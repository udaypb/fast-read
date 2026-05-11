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
    private statusEl: HTMLElement;
    private statusText: HTMLElement;
    private statusDot: HTMLElement;

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
    private manualBackgroundId: string | null = null;
    private isInternalScroll = false;
    private _isDragging = false;
    private wpm = 250;
    private chunkControls: HTMLElement;
    private chunkValueEl: HTMLElement;
    private speedInput: HTMLInputElement;
    private compactPlayBtn: HTMLButtonElement;
    private deleteBtn: HTMLButtonElement;
    private onDelete?: () => void;
    private onStatusClick?: () => void;
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
        this.playPauseBtn.innerHTML = '<span>⏸</span>';
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

        // Status Bar
        this.statusEl = document.createElement('div');
        this.statusEl.className = 'reels-status-bar';
        this.statusEl.style.opacity = '0'; // Hidden by default
        this.statusDot = document.createElement('div');
        this.statusDot.className = 'reels-status-dot';
        this.statusText = document.createElement('div');
        this.statusText.className = 'reels-status-text';
        this.statusEl.appendChild(this.statusDot);
        this.statusEl.appendChild(this.statusText);
        this.statusEl.addEventListener('click', () => this.onStatusClick?.());

        // Append loader and status bar directly to contentEl
        this.contentEl.appendChild(this.loaderEl);
        this.contentEl.appendChild(this.statusEl);

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

        const topRow = document.createElement('div');
        topRow.className = 'reels-chunk-row';

        const speedLabel = document.createElement('div');
        speedLabel.className = 'reels-chunk-label';
        speedLabel.textContent = 'Speed';

        this.chunkValueEl = document.createElement('div');
        this.chunkValueEl.className = 'reels-chunk-value';
        this.chunkValueEl.textContent = `${this.wpm} WPM`;
        topRow.append(speedLabel, this.chunkValueEl);

        const speedShell = document.createElement('div');
        speedShell.className = 'slider-shell slider-shell--reels';

        const speedScale = document.createElement('div');
        speedScale.className = 'slider-scale slider-scale--reels';
        speedScale.innerHTML = '<span>Min</span><span>Mid</span><span>Max</span>';

        this.speedInput = document.createElement('input');
        this.speedInput.type = 'range';
        this.speedInput.className = 'reels-speed-slider';
        this.speedInput.min = '150';
        this.speedInput.max = '700';
        this.speedInput.step = '25';
        this.speedInput.value = String(this.wpm);
        this.speedInput.addEventListener('input', (event) => {
            event.stopPropagation();
            const next = Number(this.speedInput.value);
            this.setWpm(next);
            this.onWpmChange?.(next);
        });

        const speedRow = document.createElement('div');
        speedRow.className = 'slider-row slider-row--reels';
        speedRow.append(this.speedInput);

        this.compactPlayBtn = document.createElement('button');
        this.compactPlayBtn.type = 'button';
        this.compactPlayBtn.className = 'reels-compact-play-btn';
        this.compactPlayBtn.innerHTML = '<span>⏸</span>';
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

        speedShell.append(speedScale, speedRow);
        this.chunkControls.append(topRow, speedShell);

        this.setWpm(this.wpm);

        this.contentEl.append(
            this.progressContainer,
            this.frameCounter,
            this.playPauseIndicator,
            this.deleteBtn,
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
                    screen.activate(this.manualBackgroundId);
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

    updateStatus(count: number, isDone: boolean): void {
        if (count === 0 && !isDone) {
            this.statusEl.style.opacity = '0';
            return;
        }

        this.statusEl.style.opacity = '1';
        if (isDone) {
            this.statusText.textContent = `${count} reels available`;
            this.statusDot.classList.remove('pulsing');
            this.statusDot.style.background = '#4CAF50'; // Green for done
        } else {
            this.statusText.textContent = `${count} reels generated...`;
            this.statusDot.classList.add('pulsing');
            this.statusDot.style.background = 'var(--accent)';
        }
    }
    // ... (keep existing methods up to playTransition)
    showEmptyState(show: boolean, options?: { message?: string }): void {
        this.isEmptyState = show;

        const emptyStateMessage = options?.message ?? 'No reels yet — paste text or upload a PDF to get started.';

        if (show) {
            // Ensure an empty screen always exists so we never land on a blank black view.
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
            // Create a temporary empty screen so we can show the "No reels" message and background
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
                screen.activate('intro');
                screen.setTextContent(emptyStateMessage);
                screen.addTextClass('reels-player-text--empty');
            }
            return;
        }

        const activeScreen = this.activeReelId ? this.screens.get(this.activeReelId) : null;

        this.contentEl.classList.toggle('reels-empty-state', show);

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

    public setManualBackground(id: string | null): void {
        this.manualBackgroundId = id;
        const active = this.activeReelId ? this.screens.get(this.activeReelId) : null;
        if (active) {
            active.activate(this.manualBackgroundId);
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
            screen.activate(this.manualBackgroundId);
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
        this.playPauseBtn.innerHTML = playing ? '<span>⏸</span>' : '<span>▶</span>';
        this.compactPlayBtn.innerHTML = playing ? '<span>⏸</span>' : '<span>▶</span>';
    }

    public showPlayPauseIndicator(playing: boolean): void {
        this.playPauseIndicator.innerHTML = playing ? '<span>▶</span>' : '<span>⏸</span>';

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
        onStatusClick?: () => void;
        onPreviewExpandChange?: (expanded: boolean) => void;
    }): void {
        this.onPlayPause = handler.onPlayPause;
        this.onSeek = handler.onSeek;
        this.onWpmChange = handler.onWpmChange;
        this.onActiveReelChange = handler.onActiveReelChange;
        this.onDelete = handler.onDelete;
        this.onStatusClick = handler.onStatusClick;
        this.onPreviewExpandChange = handler.onPreviewExpandChange;
    }

    setWpm(wpm: number): void {
        this.wpm = Math.max(150, Math.min(700, wpm));
        this.chunkValueEl.textContent = `${this.wpm} WPM`;
        this.speedInput.value = String(this.wpm);
        const progress = ((this.wpm - 150) / (700 - 150)) * 100;
        this.speedInput.style.setProperty('--slider-progress', `${progress}%`);
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
        this.textWindow.append(topBar, windowHeader, this.textClipEl, this.previewEl, bottomBar);

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

    activate(manualStyleId: string | null): void {
        const styleId = (this.reel.reelId === 'empty')
            ? (manualStyleId || 'intro')
            : (manualStyleId || this.reel.backgroundId || 'net');
        this.background.start(styleId);
    }

    deactivate(): void {
        this.background.stop();
    }

    setFrame(frame: Frame | null): void {
        if (!frame) {
            this.textEl.textContent = '';
            this.updatePreviewHighlight(null);
            this.clearCharacter();
            return;
        }
        this.textEl.textContent = frame.tokens.map((token) => token.text).join(' ');
        this.fitTextToWindow();
        this.updatePreviewHighlight(frame);

        this.updateCharacterFromFrame(frame);
    }

    setTextContent(text: string): void {
        this.textEl.textContent = text;
        this.renderPreviewTokens(text);
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
