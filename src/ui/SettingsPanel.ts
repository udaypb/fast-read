import { DisplayMode } from './ReelsPlayer';
import { backgroundCatalog } from './backgrounds/catalog';
import type { Reel } from '../api/types';

export type SettingsPanelHandlers = {
    onModeChange: (mode: DisplayMode) => void;
    onStyleChange: (category: string, specificId?: string) => void;
    onPlayPause?: () => void;
    onRewind?: () => void;
    onForward?: () => void;
    onWpmChange?: (wpm: number) => void;
    onChunkSizeChange?: (size: number) => void;
    onReelSelect?: (reel: Reel) => void;
};

export class SettingsPanel {
    private root: HTMLElement;
    private contentWrapper: HTMLElement;
    private playPauseBtn: HTMLButtonElement;
    private wpmInput?: HTMLInputElement;
    private wpmValue?: HTMLElement;
    private chunkInput?: HTMLInputElement;
    private chunkValue?: HTMLElement;
    private isOpen = false;
    private handlers?: SettingsPanelHandlers;
    private activeMode: DisplayMode = DisplayMode.Standard;
    private activeCategory = 'calming';
    private activeId?: string;
    private modeButtons: Map<DisplayMode, HTMLButtonElement> = new Map();
    private categoryTabs: HTMLElement[] = [];
    private previewsContainer: HTMLElement;
    private reels: Reel[] = [];
    private activeReelId: string | null = null;
    private reelPreviewsContainer: HTMLElement;

    private categories = [
        { id: 'calming', label: 'Calming' },
        { id: 'cartoon', label: 'Cartoon' },
        { id: 'satisfying', label: 'Satisfying' },
        { id: 'subway', label: 'Subway S' },
        { id: 'temple', label: 'Temple Run' },
        { id: 'minecraft', label: 'Minecraft' },
        { id: 'real', label: 'Real' }
    ];

    constructor(container: HTMLElement, initialWpm: number, initialChunkSize: number) {
        this.root = document.createElement('div');
        this.root.className = 'settings-panel';

        // Prevent scroll events from bubbling to window (which handles reel navigation)
        // This ensures the settings panel can be scrolled without triggering next/prev reel
        this.root.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
        this.root.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: false });

        // Add drag gestures
        this.initDragGestures();

        // Drag Handle for mobile sheet
        const dragHandle = document.createElement('div');
        dragHandle.className = 'settings-drag-handle';
        this.root.appendChild(dragHandle);

        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'settings-panel-content';

        // Reel previews section (Reel Mode only)
        const reelsSection = document.createElement('div');
        reelsSection.className = 'settings-section settings-reel-section';

        const reelsHeader = document.createElement('div');
        reelsHeader.className = 'settings-section-header';
        reelsHeader.textContent = 'Reels';

        this.reelPreviewsContainer = document.createElement('div');
        this.reelPreviewsContainer.className = 'settings-reel-previews';
        this.renderReelPreviews();

        reelsSection.append(reelsHeader, this.reelPreviewsContainer);
        this.contentWrapper.appendChild(reelsSection);

        // Playback Controls Section
        const controlsSection = document.createElement('div');
        controlsSection.className = 'settings-section settings-controls';

        const transportRow = document.createElement('div');
        transportRow.className = 'settings-transport-row';

        const rewindBtn = document.createElement('button');
        rewindBtn.className = 'settings-control-btn settings-secondary-btn';
        rewindBtn.innerHTML = '⏪';
        rewindBtn.title = 'Rewind';
        rewindBtn.addEventListener('click', () => this.handlers?.onRewind?.());

        this.playPauseBtn = document.createElement('button');
        this.playPauseBtn.className = 'settings-control-btn settings-play-btn';
        this.playPauseBtn.innerHTML = '<span>⏸</span> Pause';
        this.playPauseBtn.addEventListener('click', () => {
            this.handlers?.onPlayPause?.();
        });

        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'settings-control-btn settings-secondary-btn';
        forwardBtn.innerHTML = '⏩';
        forwardBtn.title = 'Forward';
        forwardBtn.addEventListener('click', () => this.handlers?.onForward?.());

        transportRow.append(rewindBtn, this.playPauseBtn, forwardBtn);
        controlsSection.appendChild(transportRow);

        // Sliders Section (WPM & Words/Frame)
        const slidersContainer = document.createElement('div');
        slidersContainer.className = 'settings-sliders-container';

        // WPM Slider
        const wpmRow = document.createElement('div');
        wpmRow.className = 'settings-slider-row';
        const wpmLabel = document.createElement('div');
        wpmLabel.className = 'settings-slider-label';
        wpmLabel.textContent = 'Speed';

        this.wpmValue = document.createElement('div');
        this.wpmValue.className = 'settings-slider-value';
        this.wpmValue.textContent = `${initialWpm} WPM`;

        const wpmHeader = document.createElement('div');
        wpmHeader.className = 'settings-slider-header';
        wpmHeader.append(wpmLabel, this.wpmValue);

        this.wpmInput = document.createElement('input');
        this.wpmInput.type = 'range';
        this.wpmInput.className = 'settings-range-input';
        this.wpmInput.min = '150';
        this.wpmInput.max = '700';
        this.wpmInput.step = '25';
        this.wpmInput.value = String(initialWpm);
        this.wpmInput.addEventListener('input', () => {
            const val = Number(this.wpmInput!.value);
            if (this.wpmValue) this.wpmValue.textContent = `${val} WPM`;
            this.handlers?.onWpmChange?.(val);
        });

        wpmRow.append(wpmHeader, this.wpmInput);

        // Chunk Size Slider
        const chunkRow = document.createElement('div');
        chunkRow.className = 'settings-slider-row';
        const chunkLabel = document.createElement('div');
        chunkLabel.className = 'settings-slider-label';
        chunkLabel.textContent = 'Words Per Frame';

        this.chunkValue = document.createElement('div');
        this.chunkValue.className = 'settings-slider-value';
        this.chunkValue.textContent = initialChunkSize === 1 ? '1 word' : `${initialChunkSize} words`;

        const chunkHeader = document.createElement('div');
        chunkHeader.className = 'settings-slider-header';
        chunkHeader.append(chunkLabel, this.chunkValue);

        this.chunkInput = document.createElement('input');
        this.chunkInput.type = 'range';
        this.chunkInput.className = 'settings-range-input';
        this.chunkInput.min = '1';
        this.chunkInput.max = '6'; // Allow up to 6 words
        this.chunkInput.step = '1';
        this.chunkInput.value = String(initialChunkSize);
        this.chunkInput.addEventListener('input', () => {
            const val = Number(this.chunkInput!.value);
            const label = val === 1 ? '1 word' : `${val} words`;
            if (this.chunkValue) this.chunkValue.textContent = label;
            this.handlers?.onChunkSizeChange?.(val);
        });

        chunkRow.append(chunkHeader, this.chunkInput);

        slidersContainer.append(wpmRow, chunkRow);
        controlsSection.appendChild(slidersContainer);

        this.contentWrapper.appendChild(controlsSection);

        // Mode selector section
        const modeSection = document.createElement('div');
        modeSection.className = 'settings-section';

        const modeHeader = document.createElement('div');
        modeHeader.className = 'settings-section-header';
        modeHeader.textContent = 'Display Mode';
        modeSection.appendChild(modeHeader);

        const modeButtons = document.createElement('div');
        modeButtons.className = 'settings-mode-buttons';

        this.createModeButton(DisplayMode.Standard, '<div class="mode-icon-wide">16:9</div>', 'Standard style', modeButtons);
        this.createModeButton(DisplayMode.Portrait, '<div class="mode-icon-tall">9:16</div>', 'Reel style', modeButtons);

        modeSection.appendChild(modeButtons);
        this.contentWrapper.appendChild(modeSection);

        // Background styles section
        const styleSection = document.createElement('div');
        styleSection.className = 'settings-section';

        const styleHeader = document.createElement('div');
        styleHeader.className = 'settings-section-header';
        styleHeader.textContent = 'Background Style';
        styleSection.appendChild(styleHeader);

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'settings-style-tabs';
        this.renderTabs(tabsContainer);
        styleSection.appendChild(tabsContainer);

        this.previewsContainer = document.createElement('div');
        this.previewsContainer.className = 'settings-style-previews';
        this.renderPreviews();
        styleSection.appendChild(this.previewsContainer);

        this.contentWrapper.appendChild(styleSection);
        this.root.appendChild(this.contentWrapper);
        container.appendChild(this.root);
    }

    public setPlaying(isPlaying: boolean): void {
        this.playPauseBtn.innerHTML = isPlaying
            ? '<span>⏸</span> Pause'
            : '<span>▶</span> Play';

        if (isPlaying) {
            this.playPauseBtn.classList.remove('settings-play-btn--paused');
        } else {
            this.playPauseBtn.classList.add('settings-play-btn--paused');
        }
    }

    private createModeButton(mode: DisplayMode, icon: string, label: string, container: HTMLElement): void {
        const btn = document.createElement('button');
        btn.className = 'settings-mode-btn';
        btn.innerHTML = `<span class="mode-btn-icon">${icon}</span><span class="mode-btn-label">${label}</span>`;
        btn.title = label;

        btn.addEventListener('click', () => {
            this.activeMode = mode;
            this.updateModeState();
            this.handlers?.onModeChange(mode);
            this.toggle(); // Close automatically on switch
        });

        this.modeButtons.set(mode, btn);
        container.appendChild(btn);
    }

    private updateModeState(): void {
        this.modeButtons.forEach((btn, mode) => {
            if (mode === this.activeMode) {
                btn.classList.add('settings-mode-btn--active');
            } else {
                btn.classList.remove('settings-mode-btn--active');
            }
        });
    }

    private renderTabs(container: HTMLElement): void {
        this.categoryTabs = [];
        this.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.label;
            btn.className = 'settings-style-tab';

            btn.addEventListener('click', () => {
                this.activeCategory = cat.id;
                this.updateTabState();
                this.renderPreviews();
                this.handlers?.onStyleChange(cat.id);
            });

            this.categoryTabs.push(btn);
            container.appendChild(btn);
        });

        this.updateTabState();
    }

    private updateTabState(): void {
        this.categoryTabs.forEach((tab, index) => {
            const cat = this.categories[index];
            if (cat.id === this.activeCategory) {
                tab.classList.add('settings-style-tab--active');
            } else {
                tab.classList.remove('settings-style-tab--active');
            }
        });
    }

    private renderPreviews(): void {
        this.previewsContainer.innerHTML = '';
        const items = backgroundCatalog.filter(item => item.category === this.activeCategory);

        if (items.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'settings-preview-empty';
            msg.textContent = 'No options available';
            this.previewsContainer.appendChild(msg);
            return;
        }

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'settings-preview-item';
            if (this.activeId === item.id) {
                btn.classList.add('settings-preview-item--active');
            }

            // Always show the label centered
            const label = document.createElement('div');
            label.className = 'settings-preview-name-only';
            label.textContent = item.label;
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                this.activeId = item.id;
                this.updatePreviewState();
                this.handlers?.onStyleChange(this.activeCategory, item.id);
                this.toggle(); // Close automatically on background selection
            });

            this.previewsContainer.appendChild(btn);
        });
    }

    private renderReelPreviews(): void {
        this.reelPreviewsContainer.innerHTML = '';

        if (this.reels.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'settings-reel-empty';
            msg.textContent = 'No reels yet';
            this.reelPreviewsContainer.appendChild(msg);
            return;
        }

        this.reels.forEach((reel) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'settings-reel-card';
            btn.dataset.reelId = reel.reelId;
            if (this.activeReelId === reel.reelId) {
                btn.classList.add('settings-reel-card--active');
            }

            const title = document.createElement('div');
            title.className = 'settings-reel-title';
            title.textContent = reel.title || `Reel ${reel.index + 1}`;

            btn.appendChild(title);
            btn.addEventListener('click', () => {
                this.activeReelId = reel.reelId;
                this.updateReelPreviewState();
                this.handlers?.onReelSelect?.(reel);
            });

            this.reelPreviewsContainer.appendChild(btn);
        });
    }

    private updateReelPreviewState(): void {
        const cards = this.reelPreviewsContainer.querySelectorAll('.settings-reel-card');
        cards.forEach((card) => {
            const isActive = (card as HTMLElement).dataset.reelId === this.activeReelId;
            card.classList.toggle('settings-reel-card--active', isActive);
        });
    }

    private updatePreviewState(): void {
        const buttons = this.previewsContainer.querySelectorAll('.settings-preview-item');
        const items = backgroundCatalog.filter(item => item.category === this.activeCategory);

        buttons.forEach((btn, index) => {
            if (items[index].id === this.activeId) {
                btn.classList.add('settings-preview-item--active');
            } else {
                btn.classList.remove('settings-preview-item--active');
            }
        });
    }

    public toggle(): void {
        this.isOpen = !this.isOpen;
        this.updatePanelState();
    }

    private updatePanelState(): void {
        const parent = this.root.parentElement;
        if (this.isOpen) {
            // Measure height for smooth push animation
            const height = this.contentWrapper.getBoundingClientRect().height;
            parent?.style.setProperty('--panel-height', `${height}px`);

            this.root.classList.add('open');
            parent?.classList.add('settings-open');
            this.root.style.transform = ''; // Clear any drag transform
        } else {
            this.root.classList.remove('open');
            parent?.classList.remove('settings-open');
            this.root.style.transform = ''; // Clear any drag transform
        }
    }

    private initDragGestures(): void {
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        let isAtTop = true;

        const onPointerDown = (e: PointerEvent) => {
            // Only allow dragging in portrait mode (bottom sheet)
            if (!this.isOpen || this.activeMode !== DisplayMode.Portrait) return;

            // Check if clicking on handle or if content is at top
            const target = e.target as HTMLElement;
            const isHandle = target.classList.contains('settings-drag-handle');

            // If clicking on a button, input, or interactive link, don't drag
            if (!isHandle && (
                target.tagName === 'BUTTON' ||
                target.tagName === 'INPUT' ||
                target.closest('.settings-preview-item') ||
                target.closest('.settings-style-tab') ||
                target.closest('.settings-reel-card')
            )) return;

            const content = this.contentWrapper;
            isAtTop = content.scrollTop <= 0;

            // Drag from handle or drag down from top of content
            if (!isHandle && !isAtTop) return;

            isDragging = true;
            startY = e.clientY;
            currentY = 0;

            this.root.setPointerCapture(e.pointerId);
            this.root.style.transition = 'none';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isDragging) return;

            const deltaY = e.clientY - startY;
            if (deltaY < 0) {
                // Dragging up? If we are at top, maybe small rubber band? 
                // For now, just allow moving down.
                currentY = deltaY * 0.2; // Small resistance
            } else {
                currentY = deltaY;
            }

            this.root.style.transform = `translateY(${currentY}px)`;

            // If dragging significantly, fade it?
            const opacity = Math.max(0.5, 1 - (deltaY / 500));
            this.root.style.opacity = String(opacity);
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging) return;
            isDragging = false;
            this.root.releasePointerCapture(e.pointerId);
            this.root.style.transition = '';
            this.root.style.opacity = '';

            // Threshold to close: 100px or fast flick?
            if (currentY > 120) {
                this.isOpen = false;
                this.updatePanelState();
            } else {
                this.root.style.transform = '';
            }
        };

        this.root.addEventListener('pointerdown', onPointerDown);
        this.root.addEventListener('pointermove', onPointerMove);
        this.root.addEventListener('pointerup', onPointerUp);
        this.root.addEventListener('pointercancel', onPointerUp);
    }

    public setMode(mode: DisplayMode): void {
        this.activeMode = mode;
        this.updateModeState();
    }

    public setActiveStyle(category: string): void {
        this.activeCategory = category;
        this.updateTabState();
        this.renderPreviews();
    }

    public setReels(reels: Reel[], options?: { activeReelId?: string; align?: 'start' | 'end' }): void {
        this.reels = reels;
        if (options?.activeReelId !== undefined) {
            this.activeReelId = options.activeReelId;
        }
        this.renderReelPreviews();
        if (options?.align === 'end') {
            this.reelPreviewsContainer.scrollLeft = this.reelPreviewsContainer.scrollWidth;
        } else if (options?.align === 'start') {
            this.reelPreviewsContainer.scrollLeft = 0;
        }
    }

    public setActiveReel(reelId: string | null): void {
        this.activeReelId = reelId;
        this.updateReelPreviewState();
    }

    public setWpm(wpm: number): void {
        if (this.wpmInput) {
            this.wpmInput.value = String(wpm);
        }
        if (this.wpmValue) {
            this.wpmValue.textContent = `${wpm} WPM`;
        }
    }

    public setChunkSize(size: number): void {
        if (this.chunkInput) {
            this.chunkInput.value = String(size);
        }
        if (this.chunkValue) {
            this.chunkValue.textContent = size === 1 ? '1 word' : `${size} words`;
        }
    }

    public bind(handlers: SettingsPanelHandlers): void {
        this.handlers = handlers;
    }

    public getElement(): HTMLElement {
        return this.root;
    }
}
