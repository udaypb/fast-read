export type ImportHandlers = {
  onImportText: (text: string) => void;
  onImportFile: (file: File) => void;
};

const MAX_WORDS = 50000;

export class ImportDialog {
  private root: HTMLElement;
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private wordCount: HTMLElement;
  private errorText: HTMLElement;
  private submitButton: HTMLButtonElement;
  private mainButton: HTMLButtonElement;
  private fileInput: HTMLInputElement;
  private handlers: Partial<ImportHandlers> = {};

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'import-root';

    this.mainButton = document.createElement('button');
    this.mainButton.type = 'button';
    this.mainButton.className = 'import-button';
    this.mainButton.textContent = 'Import PDF or Text';

    this.overlay = document.createElement('div');
    this.overlay.className = 'import-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'import-panel';

    const header = document.createElement('div');
    header.className = 'import-header';

    const title = document.createElement('h2');
    title.className = 'import-title';
    title.textContent = 'Add Reading Material';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'import-close';
    close.textContent = 'Close';

    header.append(title, close);

    const fileSection = document.createElement('div');
    fileSection.className = 'import-section';

    const fileLabel = document.createElement('div');
    fileLabel.className = 'import-label';
    fileLabel.textContent = 'Upload a PDF';

    const fileButton = document.createElement('button');
    fileButton.type = 'button';
    fileButton.className = 'import-action';
    fileButton.textContent = 'Choose PDF File';

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'application/pdf';
    this.fileInput.className = 'import-file-input';

    fileSection.append(fileLabel, fileButton, this.fileInput);

    const textSection = document.createElement('div');
    textSection.className = 'import-section';

    const textLabel = document.createElement('div');
    textLabel.className = 'import-label';
    textLabel.textContent = 'Paste text (max 50,000 words)';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'import-textarea';
    this.textarea.rows = 6;
    this.textarea.placeholder = 'Paste text here...';

    const metaRow = document.createElement('div');
    metaRow.className = 'import-meta';

    this.wordCount = document.createElement('div');
    this.wordCount.className = 'import-count';
    this.wordCount.textContent = '0 words';

    this.errorText = document.createElement('div');
    this.errorText.className = 'import-error';

    metaRow.append(this.wordCount, this.errorText);

    this.submitButton = document.createElement('button');
    this.submitButton.type = 'button';
    this.submitButton.className = 'import-action import-submit';
    this.submitButton.textContent = 'Use Text';

    textSection.append(textLabel, this.textarea, metaRow, this.submitButton);

    this.panel.append(header, fileSection, textSection);
    this.overlay.append(this.panel);

    // Append overlay to body to ensure it breaks out of any parent transforms
    document.body.appendChild(this.overlay);

    this.root.append(this.mainButton);
    container.append(this.root);

    this.mainButton.addEventListener('click', () => this.open());
    close.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    fileButton.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => this.handleFileSelection());

    this.textarea.addEventListener('input', () => this.updateTextState());
    this.submitButton.addEventListener('click', () => this.submitText());

    this.updateTextState();
  }

  bind(handlers: ImportHandlers): void {
    this.handlers = handlers;
  }

  open(): void {
    this.overlay.classList.add('import-overlay--open');
  }

  close(): void {
    this.overlay.classList.remove('import-overlay--open');
    this.textarea.value = '';
    this.errorText.textContent = '';
    this.updateTextState();
  }

  private handleFileSelection(): void {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    this.handlers.onImportFile?.(file);
    this.fileInput.value = '';
    this.close();
  }

  private submitText(): void {
    const text = this.textarea.value.trim();
    const count = countWords(text);

    if (!text) {
      this.errorText.textContent = 'Paste some text to continue.';
      return;
    }

    if (count > MAX_WORDS) {
      this.errorText.textContent = `Reduce to ${MAX_WORDS.toLocaleString()} words or fewer.`;
      return;
    }

    this.handlers.onImportText?.(text);
    this.close();
  }

  private updateTextState(): void {
    const count = countWords(this.textarea.value);
    this.wordCount.textContent = `${count.toLocaleString()} words`;

    if (count > MAX_WORDS) {
      this.errorText.textContent = `Limit is ${MAX_WORDS.toLocaleString()} words.`;
    } else {
      this.errorText.textContent = '';
    }

    this.submitButton.disabled = count === 0 || count > MAX_WORDS;
  }
  setMinimized(minimized: boolean): void {
    this.root.classList.toggle('import-root--minimized', minimized);
  }

  show(): void {
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  setButtonText(text: string): void {
    this.mainButton.textContent = text;
  }
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}
