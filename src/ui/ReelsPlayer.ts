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
    private styleBtn: HTMLButtonElement;
    private mode: DisplayMode = DisplayMode.Standard;
    private onPlayPause?: () => void;
    private onStyleClick?: () => void;

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
        this.playPauseBtn.innerHTML = '<span>⏸</span>'; // Default to playing icon if we auto-start
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onPlayPause?.();
        });

        this.styleBtn = document.createElement('button');
        this.styleBtn.className = 'reels-style-btn';
        this.styleBtn.innerHTML = '✨';
        this.styleBtn.title = 'Change Background';
        this.styleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onStyleClick?.();
        });

        this.contentEl.appendChild(this.textEl);
        this.contentEl.appendChild(this.playPauseBtn);
        this.contentEl.appendChild(this.styleBtn);
        this.root.appendChild(this.contentEl);
        container.appendChild(this.root);
    }

    setFrame(frame: Frame | null): void {
        if (!frame) {
            this.textEl.textContent = '';
            return;
        }

        this.textEl.textContent = frame.text;

        // Smooth transition for words
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

    bind(handler: { onPlayPause?: () => void, onStyleClick?: () => void }): void {
        if (handler.onPlayPause) this.onPlayPause = handler.onPlayPause;
        if (handler.onStyleClick) this.onStyleClick = handler.onStyleClick;
    }
}
