export class SettingsButton {
    private root: HTMLButtonElement;
    private onClick?: () => void;

    constructor(container: HTMLElement) {
        this.root = document.createElement('button');
        this.root.className = 'settings-button';
        this.root.innerHTML = '✨';
        this.root.title = 'Change Background';

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
