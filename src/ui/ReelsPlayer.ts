import { gsap } from 'gsap';
import type { Frame } from '../reader/types';

export enum DisplayMode {
    Standard = 'standard',
    Portrait = 'portrait'
}

export class ReelsPlayer {
    private root: HTMLElement;
    private contentEl: HTMLElement;
    private textEl: HTMLElement;
    private playPauseBtn: HTMLButtonElement;
    private mode: DisplayMode = DisplayMode.Standard;
    private onPlayPause?: () => void;
    private isEmptyState = false;

    private loaderEl: HTMLElement;
    private loaderText: HTMLElement;
    private statusEl: HTMLElement;
    private statusText: HTMLElement;
    private statusDot: HTMLElement;

    private progressContainer: HTMLElement;
    private progressBar: HTMLElement;
    private frameCounter: HTMLElement;

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'reels-player-root';
        this.root.style.display = 'none'; // Hidden by default

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'reels-player-content';

        this.textEl = document.createElement('div');
        this.textEl.className = 'reels-player-text';

        this.playPauseBtn = document.createElement('button');
        this.playPauseBtn.className = 'reels-play-pause-btn';
        this.playPauseBtn.innerHTML = '<span>⏸</span>';
        this.playPauseBtn.style.display = 'none'; // Hidden in favor of Settings Panel controls

        // Progress Bar (Bottom)
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'reels-progress-container';
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'reels-progress-bar';
        this.progressContainer.appendChild(this.progressBar);

        // Frame Counter (Bottom Left)
        this.frameCounter = document.createElement('div');
        this.frameCounter.className = 'reels-frame-counter';
        this.frameCounter.textContent = '0 / 0';

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

        this.contentEl.appendChild(this.textEl);
        this.contentEl.appendChild(this.playPauseBtn);
        this.contentEl.appendChild(this.loaderEl);
        this.contentEl.appendChild(this.statusEl);
        this.contentEl.appendChild(this.progressContainer);
        this.contentEl.appendChild(this.frameCounter);
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
        if (show) {
            this.textEl.textContent = 'No reels to display';
            this.textEl.classList.add('reels-player-text--empty');
            this.playPauseBtn.style.display = 'none';
        } else {
            this.textEl.classList.remove('reels-player-text--empty');
            this.playPauseBtn.style.display = 'flex';
        }
    }

    setFrame(frame: Frame | null): void {
        if (this.isEmptyState) return;
        if (!frame) {
            this.textEl.textContent = '';
            return;
        }

        this.textEl.textContent = frame.text;

        // Update progress for the current reel
        // Frame objects don't carry their total count directly, so we infer or need meaningful data.
        // But reader passes meaningful index/total in onStateChange, which main.ts calls.
        // However, here we receive a Frame object. Let's assume we rely on onStateChange for progress.
        // Wait, the user asked for "progress of reel".
        // main.ts calls reelsPlayer.setFrame(frame).
        // main.ts also calls reelsPlayer.setPlaying(state.isPlaying) in onStateChange.
        // We should add setProgress to onStateChange in main.ts instead.

        this.textEl.animate(
            [
                { opacity: 0.6, transform: 'scale(0.95)' },
                { opacity: 1, transform: 'scale(1)' }
            ],
            { duration: 100, easing: 'ease-out' }
        );
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
    }

    bind(handler: { onPlayPause: () => void }): void {
        this.onPlayPause = handler.onPlayPause;
    }

    async playTransition(direction: 'next' | 'prev', updateState: () => void | Promise<void>): Promise<void> {
        // Clone current content
        const outgoing = document.createElement('div');
        outgoing.className = 'transition-container-outgoing';
        outgoing.appendChild(this.textEl.cloneNode(true));
        outgoing.appendChild(this.playPauseBtn.cloneNode(true));
        outgoing.appendChild(this.progressContainer.cloneNode(true));
        outgoing.appendChild(this.frameCounter.cloneNode(true));
        this.contentEl.appendChild(outgoing);

        // Hide real elements
        this.textEl.style.opacity = '0';
        this.playPauseBtn.style.opacity = '0';
        this.progressContainer.style.opacity = '0';
        this.frameCounter.style.opacity = '0';

        // Update state
        await updateState();

        // New content container
        const incoming = document.createElement('div');
        incoming.className = 'transition-container-incoming';

        // We need to reflect the NEW state in the incoming container
        // Clone the elements which have effectively just been updated by updateState()
        // Note: The main elements (this.textEl, etc) have ALREADY been updated via updateState() await

        const textClone = this.textEl.cloneNode(true) as HTMLElement;
        const playBtnClone = this.playPauseBtn.cloneNode(true) as HTMLElement;
        const progressClone = this.progressContainer.cloneNode(true) as HTMLElement;
        const counterClone = this.frameCounter.cloneNode(true) as HTMLElement;

        // Ensure the progress clone reflects the reset state (0%) if it was just reset
        // The original elements are updated, so the clone should be correct,
        // but let's double check styles transfer correctly.

        incoming.appendChild(textClone);
        incoming.appendChild(playBtnClone);
        incoming.appendChild(progressClone);
        incoming.appendChild(counterClone);
        this.contentEl.appendChild(incoming);

        const yOffset = '100%';
        const duration = 0.5;
        const ease = 'power2.inOut';

        return new Promise<void>((resolve) => {
            if (direction === 'next') {
                // Determine direction: Next reel comes from bottom (positive Y)
                gsap.fromTo(outgoing,
                    { y: '0%', opacity: 1 },
                    { y: '-100%', opacity: 0.5, duration, ease }
                );
                gsap.fromTo(incoming,
                    { y: '100%', opacity: 0.5 },
                    { y: '0%', opacity: 1, duration, ease, onComplete: () => resolve() }
                );
            } else {
                // Prev reel comes from top (negative Y)
                gsap.fromTo(outgoing,
                    { y: '0%', opacity: 1 },
                    { y: '100%', opacity: 0.5, duration, ease }
                );
                gsap.fromTo(incoming,
                    { y: '-100%', opacity: 0.5 },
                    { y: '0%', opacity: 1, duration, ease, onComplete: () => resolve() }
                );
            }
        }).then(() => {
            outgoing.remove();
            incoming.remove();
            this.textEl.style.opacity = '';
            this.playPauseBtn.style.opacity = '';
            this.progressContainer.style.opacity = '';
            this.frameCounter.style.opacity = '';
        });
    }
}
