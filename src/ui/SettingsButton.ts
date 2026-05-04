export class SettingsButton {
    private root: HTMLButtonElement;
    private onClick?: () => void;

    constructor(container: HTMLElement) {
        this.root = document.createElement('button');
        this.root.className = 'settings-button';
        this.root.innerHTML = `
            <svg class="settings-button-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l1.71-1.33a.5.5 0 0 0 .12-.63l-1.62-2.8a.5.5 0 0 0-.6-.22l-2.02.81a7.27 7.27 0 0 0-1.63-.94l-.31-2.15a.5.5 0 0 0-.5-.42h-3.24a.5.5 0 0 0-.5.42l-.31 2.15c-.57.23-1.12.54-1.63.94l-2.02-.81a.5.5 0 0 0-.6.22L3.03 9.1a.5.5 0 0 0 .12.63l1.71 1.33c-.04.31-.06.63-.06.94s.02.63.06.94l-1.71 1.33a.5.5 0 0 0-.12.63l1.62 2.8a.5.5 0 0 0 .6.22l2.02-.81c.5.4 1.05.71 1.63.94l.31 2.15a.5.5 0 0 0 .5.42h3.24a.5.5 0 0 0 .5-.42l.31-2.15c.57-.23 1.12-.54 1.63-.94l2.02.81a.5.5 0 0 0 .6-.22l1.62-2.8a.5.5 0 0 0-.12-.63l-1.71-1.33ZM12 15.25A3.25 3.25 0 1 1 12 8.75a3.25 3.25 0 0 1 0 6.5Z"/>
            </svg>
        `;
        this.root.title = 'Settings';
        this.root.setAttribute('aria-label', 'Open settings');

        this.root.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onClick?.();
        });

        container.appendChild(this.root);
    }

    bind(handler: () => void): void {
        this.onClick = handler;
    }

    getElement(): HTMLElement {
        return this.root;
    }
}
