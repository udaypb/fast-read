import { backgroundCatalog } from './backgrounds/catalog';
import type { Reel } from '../api/types';

export type ReelGroup = {
    docId: string;
    label: string;
    reels: Reel[];
    isActive: boolean;
};

export type SettingsPanelHandlers = {
    onStyleChange: (category: string, specificId?: string) => void;
    onPlayPause?: () => void;
    onRewind?: () => void;
    onForward?: () => void;
    onWpmChange?: (wpm: number) => void;
    onChunkSizeChange?: (chunkSize: number) => void;
    onReelSelect?: (reel: Reel) => void;
    onReelDelete?: (reel: Reel) => void;
    onGroupSelect?: (docId: string) => void;
    onDeleteGroup?: (docId: string) => void;
};

export class SettingsPanel {
    private root: HTMLElement;
    private contentWrapper: HTMLElement;
    private playPauseBtn: HTMLButtonElement;
    private wpmInput?: HTMLInputElement;
    private wpmValue?: HTMLElement;
    private chunkButtons: HTMLButtonElement[] = [];
    private chunkValue?: HTMLElement;
    private chunkSize = 1;
    private isOpen = false;
    private handlers?: SettingsPanelHandlers;
    private activeCategory = 'calming';
    private activeId?: string;
    private categoryTabs: HTMLElement[] = [];
    private previewsContainer: HTMLElement;
    private reels: Reel[] = [];
    private groups: ReelGroup[] = [];
    private activeReelId: string | null = null;
    private groupSelectShell: HTMLElement;
    private groupMenuButton: HTMLButtonElement;
    private groupMenu: HTMLElement;
    private groupMeta: HTMLElement;
    private deleteGroupButton: HTMLButtonElement;
    private activeGroupDocId: string | null = null;
    private reelPreviewsContainer: HTMLElement;

    private categories = [
        { id: 'calming', label: 'Calming' },
        { id: 'cartoon', label: 'Cartoon' },
        { id: 'satisfying', label: 'Satisfying' },
        { id: 'subway', label: 'Subway' },
        { id: 'temple', label: 'Racing' },
        { id: 'minecraft', label: 'Minecraft' },
        { id: 'fortnite', label: 'Fortnite' },
        { id: 'real', label: 'Real' }
    ];

    constructor(container: HTMLElement, initialWpm: number, initialChunkSize: number = 1) {
        this.root = document.createElement('div');
        this.root.className = 'settings-panel';
        this.chunkSize = initialChunkSize;

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

        this.groupSelectShell = document.createElement('div');
        this.groupSelectShell.className = 'settings-group-select-shell';
        this.groupSelectShell.hidden = true;

        const groupSelectLabel = document.createElement('label');
        groupSelectLabel.className = 'settings-group-select-label';
        groupSelectLabel.textContent = 'Content uploaded so far';

        this.groupMenuButton = document.createElement('button');
        this.groupMenuButton.type = 'button';
        this.groupMenuButton.className = 'settings-group-menu-button';
        this.groupMenuButton.setAttribute('aria-haspopup', 'menu');
        this.groupMenuButton.setAttribute('aria-expanded', 'false');
        this.groupMenuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.setGroupMenuOpen(!this.groupSelectShell.classList.contains('settings-group-select-shell--open'));
        });

        this.groupMenu = document.createElement('div');
        this.groupMenu.className = 'settings-group-menu';
        this.groupMenu.setAttribute('role', 'menu');
        this.groupMenu.hidden = true;
        this.groupMenu.addEventListener('click', (event) => event.stopPropagation());
        this.groupMenu.addEventListener('pointerdown', (event) => event.stopPropagation());

        this.groupMeta = document.createElement('div');
        this.groupMeta.className = 'settings-group-select-meta';

        this.deleteGroupButton = document.createElement('button');
        this.deleteGroupButton.type = 'button';
        this.deleteGroupButton.className = 'settings-delete-group-btn';
        this.deleteGroupButton.setAttribute('aria-label', 'Delete selected group');
        this.deleteGroupButton.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5V6H20a.75.75 0 0 1 0 1.5h-1.03l-.9 11.02a2.25 2.25 0 0 1-2.24 1.98H8.17a2.25 2.25 0 0 1-2.24-1.98L5.03 7.5H4A.75.75 0 0 1 4 6h3.5v-.75A1.5 1.5 0 0 1 9 3.75ZM15 6v-.75H9V6h6ZM6.53 7.5l.89 10.9a.75.75 0 0 0 .75.6h7.66a.75.75 0 0 0 .75-.6l.89-10.9H6.53Z"/>
            </svg>
            <span>Delete</span>
        `;
        this.deleteGroupButton.disabled = true;
        this.deleteGroupButton.addEventListener('click', () => {
            const docId = this.activeGroupDocId || this.groups.find((group) => group.isActive)?.docId;
            if (!docId) return;
            this.handlers?.onDeleteGroup?.(docId);
        });

        const groupSelectRow = document.createElement('div');
        groupSelectRow.className = 'settings-group-select-row';
        groupSelectRow.append(this.groupMenuButton, this.deleteGroupButton);

        this.groupSelectShell.append(groupSelectLabel, this.groupMeta, groupSelectRow, this.groupMenu);
        document.addEventListener('click', (event) => {
            const target = event.target as Node | null;
            if (target && this.groupSelectShell.contains(target)) return;
            this.setGroupMenuOpen(false);
        });

        this.reelPreviewsContainer = document.createElement('div');
        this.reelPreviewsContainer.className = 'settings-reel-previews';
        this.renderReelPreviews();

        reelsSection.append(reelsHeader, this.groupSelectShell, this.reelPreviewsContainer);
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
        this.playPauseBtn.append(this.createPlayIcon(true), document.createTextNode(' Pause'));
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

        // Reader settings section
        const slidersContainer = document.createElement('div');
        slidersContainer.className = 'settings-sliders-container';

        const chunkRow = document.createElement('div');
        chunkRow.className = 'settings-slider-row';

        const chunkHeader = document.createElement('div');
        chunkHeader.className = 'settings-slider-header';

        const chunkLabel = document.createElement('div');
        chunkLabel.className = 'settings-slider-label';
        chunkLabel.textContent = 'Words / Frame';

        this.chunkValue = document.createElement('div');
        this.chunkValue.className = 'settings-slider-value';
        chunkHeader.append(chunkLabel, this.chunkValue);

        const chunkSegment = document.createElement('div');
        chunkSegment.className = 'settings-segmented-control';

        [1, 2, 3].forEach((size) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'settings-segmented-btn';
            btn.textContent = String(size);
            btn.addEventListener('click', () => {
                this.setChunkSize(size);
                this.handlers?.onChunkSizeChange?.(size);
            });
            this.chunkButtons.push(btn);
            chunkSegment.appendChild(btn);
        });

        chunkRow.append(chunkHeader, chunkSegment);
        this.setChunkSize(initialChunkSize);

        slidersContainer.append(chunkRow);
        controlsSection.appendChild(slidersContainer);

        this.contentWrapper.appendChild(controlsSection);

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
        this.playPauseBtn.replaceChildren(
            this.createPlayIcon(isPlaying),
            document.createTextNode(isPlaying ? ' Pause' : ' Play')
        );

        if (isPlaying) {
            this.playPauseBtn.classList.remove('settings-play-btn--paused');
        } else {
            this.playPauseBtn.classList.add('settings-play-btn--paused');
        }
    }

    private createPlayIcon(isPlaying: boolean): HTMLSpanElement {
        const icon = document.createElement('span');
        icon.className = isPlaying ? 'settings-play-icon settings-play-icon--pause' : 'settings-play-icon settings-play-icon--play';
        icon.setAttribute('aria-hidden', 'true');
        return icon;
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

        this.renderGroupSelect();

        const activeGroup = this.groups.find((group) => group.isActive) ?? this.groups[0] ?? null;
        const groups = activeGroup
            ? [activeGroup]
            : (this.reels.length > 0 ? [{ docId: '', label: '', reels: this.reels, isActive: true }] : []);

        if (groups.length === 0) {
            return;
        }

        groups.forEach((group) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'settings-reel-group';
            if (group.isActive) groupEl.classList.add('settings-reel-group--active');

            const cardsRow = document.createElement('div');
            cardsRow.className = 'settings-reel-group-cards';

            if (group.reels.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'settings-reel-empty';
                empty.textContent = 'Processing…';
                cardsRow.appendChild(empty);
            } else {
                group.reels.forEach((reel) => {
                    cardsRow.appendChild(this.createReelCard(reel));
                });
            }

            groupEl.appendChild(cardsRow);
            this.reelPreviewsContainer.appendChild(groupEl);
        });
    }

    private renderGroupSelect(): void {
        const groups = this.groups;
        this.groupMenu.innerHTML = '';
        this.groupSelectShell.hidden = groups.length === 0;
        this.deleteGroupButton.disabled = groups.length === 0;

        if (groups.length === 0) {
            this.activeGroupDocId = null;
            this.groupMenuButton.textContent = '';
            this.groupMeta.textContent = '';
            this.setGroupMenuOpen(false);
            return;
        }

        const activeGroup = groups.find((group) => group.isActive) ?? groups[0];
        this.activeGroupDocId = activeGroup.docId;
        this.groupMenuButton.replaceChildren(
            this.createTextSpan('settings-group-menu-title', activeGroup.label),
            this.createTextSpan('settings-group-menu-icon', '')
        );
        this.groupMenuButton.querySelector('.settings-group-menu-icon')?.setAttribute('aria-hidden', 'true');
        this.groupMenuButton.disabled = groups.length <= 1;

        groups.forEach((group, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'settings-group-menu-item';
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('aria-checked', String(group.docId === activeGroup.docId));
            item.dataset.docId = group.docId;
            item.append(
                this.createTextSpan('settings-group-menu-item-label', `${index + 1}. ${group.label}`),
                this.createTextSpan(
                    'settings-group-menu-item-meta',
                    group.reels.length === 1 ? '1 reel' : `${group.reels.length} reels`
                )
            );
            item.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.selectGroup(group.docId);
            });
            item.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            this.groupMenu.append(item);
        });

        const activeIndex = Math.max(0, groups.findIndex((group) => group.docId === activeGroup.docId));
        const reelCount = activeGroup.reels.length;
        const reelLabel = reelCount === 1 ? '1 reel' : `${reelCount} reels`;
        this.groupMeta.textContent = `${activeIndex + 1} of ${groups.length} · ${reelLabel}`;
    }

    private selectGroup(docId: string): void {
        const selectedGroup = this.groups.find((group) => group.docId === docId);
        if (!selectedGroup) return;

        this.groups = this.groups.map((group) => ({
            ...group,
            isActive: group.docId === docId
        }));
        this.reels = selectedGroup.reels;
        this.activeReelId = selectedGroup.reels[0]?.reelId ?? null;
        this.setGroupMenuOpen(false);
        this.renderReelPreviews();
        this.handlers?.onGroupSelect?.(docId);
    }

    private setGroupMenuOpen(open: boolean): void {
        this.groupSelectShell.classList.toggle('settings-group-select-shell--open', open);
        this.groupMenu.hidden = !open;
        this.groupMenuButton.setAttribute('aria-expanded', String(open));
    }

    private createTextSpan(className: string, text: string): HTMLSpanElement {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    }

    private createReelCard(reel: Reel): HTMLElement {
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

        const preview = document.createElement('div');
        preview.className = 'settings-reel-text-preview';
        preview.textContent = this.formatReelTextPreview(reel.text);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'settings-reel-delete-btn';
        deleteBtn.setAttribute('aria-label', `Delete ${reel.title || `Reel ${reel.index + 1}`}`);
        deleteBtn.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 3.75h6a1.5 1.5 0 0 1 1.5 1.5v.75H20a.75.75 0 0 1 0 1.5h-1.03l-.9 11.02A2.25 2.25 0 0 1 15.83 20.5H8.17a2.25 2.25 0 0 1-2.24-1.98L5.03 7.5H4a.75.75 0 0 1 0-1.5h3.5v-.75A1.5 1.5 0 0 1 9 3.75Zm6 2.25v-.75h-6V6h6ZM6.53 7.5l.89 10.9a.75.75 0 0 0 .75.6h7.66a.75.75 0 0 0 .75-.6l.89-10.9H6.53Zm3.22 2.25a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Zm4.5 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.handlers?.onReelDelete?.(reel);
        });

        btn.append(deleteBtn, title, preview);
        btn.addEventListener('click', () => {
            this.activeReelId = reel.reelId;
            this.updateReelPreviewState();
            this.handlers?.onReelSelect?.(reel);
        });

        return btn;
    }

    private formatReelTextPreview(text: string): string {
        const compact = text.replace(/\s+/g, ' ').trim();
        if (!compact) return 'No text preview';

        const maxLength = 92;
        if (compact.length <= maxLength) return compact;

        return `${compact.slice(0, maxLength).trimEnd()}...`;
    }

    private updateReelPreviewState(): void {
        const cards = this.reelPreviewsContainer.querySelectorAll<HTMLElement>('.settings-reel-card');
        cards.forEach((card) => {
            card.classList.toggle('settings-reel-card--active', card.dataset.reelId === this.activeReelId);
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

    public open(): void {
        if (this.isOpen) return;
        this.isOpen = true;
        this.updatePanelState();
    }

    public close(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.setGroupMenuOpen(false);
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

        const resetDragStyles = () => {
            this.root.style.transition = '';
            this.root.style.opacity = '';
        };

        const maybeStartDrag = (target: HTMLElement, clientY: number): boolean => {
            // Only allow dragging while the sheet is open
            if (!this.isOpen) return false;

            const isHandle = target.classList.contains('settings-drag-handle');

            if (!isHandle && (
                target.tagName === 'BUTTON' ||
                target.tagName === 'INPUT' ||
                target.closest('.settings-group-menu') ||
                target.closest('.settings-preview-item') ||
                target.closest('.settings-style-tab') ||
                target.closest('.settings-reel-card')
            )) return false;

            const content = this.contentWrapper;
            isAtTop = content.scrollTop <= 0;

            if (!isHandle && !isAtTop) return false;

            isDragging = true;
            startY = clientY;
            currentY = 0;
            this.root.style.transition = 'none';
            return true;
        };

        const handleDragMove = (clientY: number) => {
            if (!isDragging) return;

            const deltaY = clientY - startY;
            if (deltaY < 0) {
                currentY = deltaY * 0.2;
            } else {
                currentY = deltaY;
            }

            this.root.style.transform = `translateY(${currentY}px)`;

            const opacity = Math.max(0.5, 1 - (deltaY / 500));
            this.root.style.opacity = String(opacity);
        };

        const handleDragEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            resetDragStyles();

            if (currentY > 120) {
                this.isOpen = false;
                this.updatePanelState();
            } else {
                this.root.style.transform = '';
            }
        };

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement;
            if (!maybeStartDrag(target, e.clientY)) return;

            this.root.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e: PointerEvent) => {
            handleDragMove(e.clientY);
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging) return;
            this.root.releasePointerCapture(e.pointerId);
            handleDragEnd();
        };

        const onTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            if (!touch) return;
            const target = e.target as HTMLElement;
            if (!maybeStartDrag(target, touch.clientY)) return;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            if (!touch) return;
            handleDragMove(touch.clientY);
            e.preventDefault();
        };

        const onTouchEnd = () => {
            handleDragEnd();
        };

        this.root.addEventListener('pointerdown', onPointerDown);
        this.root.addEventListener('pointermove', onPointerMove);
        this.root.addEventListener('pointerup', onPointerUp);
        this.root.addEventListener('pointercancel', onPointerUp);
        this.root.addEventListener('touchstart', onTouchStart, { passive: false });
        this.root.addEventListener('touchmove', onTouchMove, { passive: false });
        this.root.addEventListener('touchend', onTouchEnd);
        this.root.addEventListener('touchcancel', onTouchEnd);
    }

    public setActiveStyle(category: string): void {
        this.activeCategory = category;
        this.updateTabState();
        this.renderPreviews();
    }

    public setGroups(groups: ReelGroup[], activeReelId?: string | null): void {
        const active = groups.find(g => g.isActive) ?? groups[0];
        this.groups = groups;
        // Keep flat reels list synced to the active group for backwards compat
        this.reels = active?.reels ?? [];
        if (activeReelId !== undefined) {
            this.activeReelId = activeReelId ?? null;
        }
        this.renderReelPreviews();
    }

    public setReels(reels: Reel[], options?: { activeReelId?: string; align?: 'start' | 'end' }): void {
        this.reels = reels;
        // Clear groups so the flat list is used
        this.groups = [];
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
            this.wpmInput.style.setProperty('--slider-progress', `${((wpm - 150) / (700 - 150)) * 100}%`);
        }
        if (this.wpmValue) {
            this.wpmValue.textContent = `${wpm} WPM`;
        }
    }

    public setChunkSize(chunkSize: number): void {
        this.chunkSize = Math.max(1, Math.min(3, chunkSize));
        if (this.chunkValue) {
            const label = this.chunkSize === 1 ? '1 word' : `${this.chunkSize} words`;
            this.chunkValue.textContent = label;
        }

        this.chunkButtons.forEach((btn, index) => {
            const value = index + 1;
            btn.classList.toggle('settings-segmented-btn--active', value === this.chunkSize);
        });
    }

    public bind(handlers: SettingsPanelHandlers): void {
        this.handlers = handlers;
    }

    public getElement(): HTMLElement {
        return this.root;
    }
}
