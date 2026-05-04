export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export class ConfirmDialog {
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private cancelBtn: HTMLButtonElement;
  private confirmBtn: HTMLButtonElement;
  private resolver: ((result: boolean) => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'confirm-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'confirm-panel';

    this.titleEl = document.createElement('h3');
    this.titleEl.className = 'confirm-title';

    this.messageEl = document.createElement('p');
    this.messageEl.className = 'confirm-message';

    const actions = document.createElement('div');
    actions.className = 'confirm-actions';

    this.cancelBtn = document.createElement('button');
    this.cancelBtn.type = 'button';
    this.cancelBtn.className = 'confirm-btn confirm-btn--secondary';
    this.cancelBtn.textContent = 'Cancel';

    this.confirmBtn = document.createElement('button');
    this.confirmBtn.type = 'button';
    this.confirmBtn.className = 'confirm-btn confirm-btn--danger';
    this.confirmBtn.textContent = 'Delete';

    actions.append(this.cancelBtn, this.confirmBtn);
    this.panel.append(this.titleEl, this.messageEl, actions);
    this.overlay.append(this.panel);
    document.body.appendChild(this.overlay);

    this.cancelBtn.addEventListener('click', () => this.close(false));
    this.confirmBtn.addEventListener('click', () => this.close(true));
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.close(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.overlay.classList.contains('confirm-overlay--open')) {
        this.close(false);
      }
    });
  }

  open(options: ConfirmDialogOptions): Promise<boolean> {
    this.titleEl.textContent = options.title;
    this.messageEl.textContent = options.message;
    this.cancelBtn.textContent = options.cancelLabel ?? 'Cancel';
    this.confirmBtn.textContent = options.confirmLabel ?? 'Delete';
    this.overlay.classList.add('confirm-overlay--open');

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  private close(result: boolean): void {
    if (!this.overlay.classList.contains('confirm-overlay--open')) {
      return;
    }

    this.overlay.classList.remove('confirm-overlay--open');
    this.resolver?.(result);
    this.resolver = null;
  }
}
