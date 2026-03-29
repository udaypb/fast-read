import { gsap } from 'gsap';
import type { Frame } from '../reader/types';
import type { Reel, CharacterAsset, CharacterLine } from '../api/types';
import { Background } from './Background';

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
    private onChunkSizeChange?: (size: number) => void;
    private manualBackgroundId: string | null = null;
    private isInternalScroll = false;
    private _isDragging = false;
    private chunkSize = 2;
    private chunkControls: HTMLElement;
    private chunkValueEl: HTMLElement;
    private decrementChunkBtn: HTMLButtonElement;
    private incrementChunkBtn: HTMLButtonElement;
    private compactPlayBtn: HTMLButtonElement;

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
        this.decrementChunkBtn = document.createElement('button');
        this.decrementChunkBtn.type = 'button';
        this.decrementChunkBtn.className = 'reels-chunk-btn';
        this.decrementChunkBtn.textContent = '−';
        this.chunkValueEl = document.createElement('div');
        this.chunkValueEl.className = 'reels-chunk-value';
        this.chunkValueEl.textContent = `${this.chunkSize} words/frame`;
        this.incrementChunkBtn = document.createElement('button');
        this.incrementChunkBtn.type = 'button';
        this.incrementChunkBtn.className = 'reels-chunk-btn';
        this.incrementChunkBtn.textContent = '+';
        topRow.append(this.decrementChunkBtn, this.chunkValueEl, this.incrementChunkBtn);

        this.compactPlayBtn = document.createElement('button');
        this.compactPlayBtn.type = 'button';
        this.compactPlayBtn.className = 'reels-compact-play-btn';
        this.compactPlayBtn.innerHTML = '<span>⏸</span>';
        this.compactPlayBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            this.onPlayPause?.();
        });

        this.chunkControls.append(topRow);

        this.decrementChunkBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const next = Math.max(1, this.chunkSize - 1);
            if (next === this.chunkSize) return;
            this.setChunkSize(next);
            this.onChunkSizeChange?.(next);
        });

        this.incrementChunkBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const next = Math.min(4, this.chunkSize + 1);
            if (next === this.chunkSize) return;
            this.setChunkSize(next);
            this.onChunkSizeChange?.(next);
        });

        this.setChunkSize(this.chunkSize);

        this.contentEl.append(
            this.progressContainer,
            this.frameCounter,
            this.playPauseIndicator,
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
    showEmptyState(show: boolean): void {
        this.isEmptyState = show;

        const emptyStateMessage = 'Nothing to show — paste text or upload a PDF to start reading.';

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

        const screen = new ReelScreen(reel);
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
            this.isInternalScroll = true;
            this.activeReelId = reelId;
            screen.getElement().scrollIntoView({ behavior: 'smooth' });
            // Let the observer handle activation/deactivation naturally as it scrolls
            setTimeout(() => { this.isInternalScroll = false; }, 800);
        }
    }

    public clearReels(): void {
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
        onChunkSizeChange?: (size: number) => void;
        onActiveReelChange?: (reelId: string) => void;
    }): void {
        this.onPlayPause = handler.onPlayPause;
        this.onSeek = handler.onSeek;
        this.onChunkSizeChange = handler.onChunkSizeChange;
        this.onActiveReelChange = handler.onActiveReelChange;
    }

    setChunkSize(size: number): void {
        this.chunkSize = Math.max(1, Math.min(4, size));
        const label = this.chunkSize === 1 ? '1 word/frame' : `${this.chunkSize} words/frame`;
        this.chunkValueEl.textContent = label;

        const atMin = this.chunkSize <= 1;
        const atMax = this.chunkSize >= 4;
        this.decrementChunkBtn.disabled = atMin;
        this.incrementChunkBtn.disabled = atMax;
    }

    async playTransition(direction: 'next' | 'prev', updateState: () => void | Promise<void>): Promise<void> {
        // No longer used, handled by native scroll
        await updateState();
    }
}

class ReelScreen {
    private root: HTMLElement;
    private textWindow: HTMLElement;
    private textEl: HTMLElement;
    private characterOverlay: HTMLElement;
    private characterImage: HTMLImageElement;
    private backgroundContainer: HTMLElement;
    private background: Background;
    private reel: Reel;
    private characterAssetMap: Map<string, CharacterAsset> = new Map();

    constructor(reel: Reel) {
        this.reel = reel;
        this.root = document.createElement('div');
        this.root.className = 'reel-screen';
        this.root.dataset.reelId = reel.reelId;

        this.backgroundContainer = document.createElement('div');
        this.backgroundContainer.className = 'reel-screen-background';

        this.background = new Background(this.backgroundContainer);

        this.textWindow = document.createElement('div');
        this.textWindow.className = 'reels-player-reader-window';

        const topBar = document.createElement('div');
        topBar.className = 'reels-player-bar reels-player-bar-top';

        const bottomBar = document.createElement('div');
        bottomBar.className = 'reels-player-bar reels-player-bar-bottom';

        this.textEl = document.createElement('div');
        this.textEl.className = 'reels-player-text';
        this.textEl.textContent = ''; // Will be updated by reader

        this.textWindow.append(topBar, this.textEl, bottomBar);

        this.characterOverlay = document.createElement('div');
        this.characterOverlay.className = 'reel-character-overlay';

        this.characterImage = document.createElement('img');
        this.characterImage.className = 'reel-character-image';
        this.characterImage.alt = '';
        this.characterImage.loading = 'lazy';
        this.characterOverlay.append(this.characterImage);

        this.refreshCharacterAssets();

        this.root.append(this.backgroundContainer, this.characterOverlay, this.textWindow);
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
            this.clearCharacter();
            return;
        }
        this.textEl.textContent = frame.text;

        this.updateCharacterFromFrame(frame);
    }

    setTextContent(text: string): void {
        this.textEl.textContent = text;
    }

    addTextClass(className: string): void {
        this.textEl.classList.add(className);
    }

    removeTextClass(className: string): void {
        this.textEl.classList.remove(className);
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
}
