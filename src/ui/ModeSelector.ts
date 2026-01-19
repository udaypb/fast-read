import { DisplayMode } from './ReelsPlayer';

export type ModeChangeHandler = (mode: DisplayMode) => void;

export class ModeSelector {
    private root: HTMLElement;
    private onModeChange?: ModeChangeHandler;
    private activeMode: DisplayMode = DisplayMode.Standard;
    private buttons: Map<DisplayMode, HTMLButtonElement> = new Map();

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'mode-selector';

        this.createButton(DisplayMode.Standard, '<div class="mode-icon-wide">16:9</div>', 'Standard style');
        this.createButton(DisplayMode.Portrait, '📱', 'Reel style');

        container.appendChild(this.root);
        this.updateActiveState();
    }

    private createButton(mode: DisplayMode, icon: string, label: string): void {
        const btn = document.createElement('button');
        btn.className = 'mode-btn';
        btn.innerHTML = `<span class="mode-btn-icon">${icon}</span><span class="mode-btn-label">${label}</span>`;
        btn.title = label;

        btn.addEventListener('click', () => {
            this.activeMode = mode;
            this.updateActiveState();
            this.onModeChange?.(mode);
        });

        this.buttons.set(mode, btn);
        this.root.appendChild(btn);
    }

    private updateActiveState(): void {
        this.buttons.forEach((btn, mode) => {
            if (mode === this.activeMode) {
                btn.classList.add('mode-btn--active');
            } else {
                btn.classList.remove('mode-btn--active');
            }
        });
    }

    bind(handler: ModeChangeHandler): void {
        this.onModeChange = handler;
    }
}
