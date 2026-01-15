import { backgroundCatalog } from './backgrounds/catalog';
import { BackgroundDefinition } from './backgrounds/types';

export type StyleSelectorHandler = (category: string, specificId?: string) => void;

export class StyleSelector {
    private root: HTMLElement;
    private activeCategory = 'calming';
    private activeId: string | undefined;
    private onSelect?: StyleSelectorHandler;
    private tabs: HTMLElement[] = [];
    private previewsContainer: HTMLElement;
    private contentWrapper: HTMLElement;
    private isOpen = false;

    private categories = [
        { id: 'calming', label: 'Calming' },
        { id: 'cartoon', label: 'Cartoon' },
        { id: 'satisfying', label: 'Satisfying' },
        { id: 'subway', label: 'Subway S' },
        { id: 'temple', label: 'Temple Run' },
        { id: 'minecraft', label: 'Minecraft' },
        { id: 'real', label: 'Real' }
    ];

    constructor(container: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'style-selector';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'style-selector-toggle';
        toggleBtn.textContent = 'Change Background';
        toggleBtn.addEventListener('click', () => this.toggle());
        this.root.appendChild(toggleBtn);

        this.contentWrapper = document.createElement('div');
        this.contentWrapper.className = 'style-selector-content';

        const innerWrapper = document.createElement('div');
        this.contentWrapper.appendChild(innerWrapper);

        const header = document.createElement('div');
        header.className = 'style-selector-header';
        header.textContent = 'Select Background Style';
        innerWrapper.appendChild(header);

        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'style-selector-tabs';
        innerWrapper.appendChild(tabsContainer);

        this.previewsContainer = document.createElement('div');
        this.previewsContainer.className = 'style-selector-previews';
        innerWrapper.appendChild(this.previewsContainer);

        this.renderTabs(tabsContainer);
        this.renderPreviews();

        this.root.appendChild(this.contentWrapper);
        container.append(this.root);
    }

    private toggle(): void {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.root.classList.add('open');
        } else {
            this.root.classList.remove('open');
        }
    }

    bind(handler: StyleSelectorHandler): void {
        this.onSelect = handler;
    }

    setActive(category: string): void {
        this.activeCategory = category;
        this.activeId = undefined; // Reset specific ID when switching category
        this.updateTabState();
        this.renderPreviews();
    }

    private renderTabs(container: HTMLElement): void {
        this.tabs = [];

        this.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.textContent = cat.label;
            btn.className = 'style-tab';

            btn.addEventListener('click', () => {
                this.setActive(cat.id);
                // When switching categories, we might want to auto-select the first one or just notify category change
                // For now, let's just notify category.
                this.onSelect?.(cat.id);
            });

            this.tabs.push(btn);
            container.append(btn);
        });

        this.updateTabState();
    }

    private updateTabState(): void {
        this.tabs.forEach((tab, index) => {
            const cat = this.categories[index];
            if (cat.id === this.activeCategory) {
                tab.classList.add('style-tab--active');
            } else {
                tab.classList.remove('style-tab--active');
            }
        });
    }

    private renderPreviews(): void {
        this.previewsContainer.innerHTML = '';

        const items = backgroundCatalog.filter(item => item.category === this.activeCategory);

        if (items.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'style-preview-empty';
            msg.textContent = 'No options available';
            this.previewsContainer.appendChild(msg);
            return;
        }

        items.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'style-preview-item';
            if (this.activeId === item.id) {
                btn.classList.add('style-preview-item--active');
            }

            if (item.thumbnail) {
                const img = document.createElement('img');
                img.src = item.thumbnail;
                img.alt = item.label;
                btn.appendChild(img);
            } else {
                const span = document.createElement('span');
                span.textContent = item.label;
                btn.appendChild(span);
            }

            const label = document.createElement('div');
            label.className = 'style-preview-label';
            label.textContent = item.label;
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                this.activeId = item.id;
                this.updatePreviewState();
                this.onSelect?.(this.activeCategory, item.id);
            });

            this.previewsContainer.appendChild(btn);
        });
    }

    private updatePreviewState(): void {
        const buttons = this.previewsContainer.querySelectorAll('.style-preview-item');
        const items = backgroundCatalog.filter(item => item.category === this.activeCategory);

        buttons.forEach((btn, index) => {
            if (items[index].id === this.activeId) {
                btn.classList.add('style-preview-item--active');
            } else {
                btn.classList.remove('style-preview-item--active');
            }
        });
    }
}
