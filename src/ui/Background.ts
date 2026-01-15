import * as THREE from 'three';
import { backgroundCatalog, getBackgroundDefinition } from './backgrounds/catalog';
import { BackgroundType, type BackgroundDefinition, type VantaEffect } from './backgrounds/types';

export class Background {
  private root: HTMLElement;
  private effect: VantaEffect | null = null;
  private currentId = 'net';
  private loadToken = 0;
  private disabled = new Set<string>();

  constructor(container: HTMLElement) {
    if (typeof window !== 'undefined') {
      const win = window as Window & { THREE?: typeof THREE; VANTA?: Record<string, unknown> };
      win.THREE = THREE;
      win.VANTA = win.VANTA ?? {};
    }
    this.root = document.createElement('div');
    this.root.className = 'bg-layer';
    container.prepend(this.root);
  }

  start(defaultId = 'net'): void {
    void this.setStyle(defaultId);
  }

  async setStyle(styleId: string): Promise<void> {
    const definition = this.resolveDefinition(styleId);
    if (!definition) return;

    if (this.currentId === definition.id && this.effect) {
      return;
    }

    const previousEffect = this.effect;
    const previousId = this.currentId;
    this.currentId = definition.id;
    const token = ++this.loadToken;

    // Only load if a loader exists (vanta/p5)
    let factory;
    if (definition.load) {
      try {
        factory = await definition.load();
      } catch (error) {
        console.warn('Failed to load background effect.', error);
        this.disabled.add(definition.id);
        this.currentId = previousId;
        if (definition.id !== 'net') {
          await this.setStyle('net');
        }
        return;
      }
    }

    if (token !== this.loadToken) return;

    if (token !== this.loadToken) return;

    // Handle Video types
    if (definition.type === BackgroundType.Video) {
      previousEffect?.destroy();
      this.effect = null;

      this.root.innerHTML = '';
      this.root.style.background = 'black'; // Reset

      if (definition.url) {
        const video = document.createElement('video');
        video.src = definition.url;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '-1';
        this.root.appendChild(video);

        this.effect = {
          destroy: () => {
            video.remove();
          }
        };
      }
      return;
    }

    // Handle Vanta/P5 types
    try {
      if (!factory) throw new Error('Factory not loaded');

      // Clear previous non-canvas content if any
      if (previousId && (getBackgroundDefinition(previousId)?.type === BackgroundType.Video)) {
        this.root.innerHTML = '';
      }

      const nextEffect = factory({
        el: this.root,
        THREE,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        color: 0xf9e2b0,
        backgroundColor: 0x000000,
        ...(definition.options ?? {})
      });
      previousEffect?.destroy();
      this.effect = nextEffect;
    } catch (error) {
      console.warn('Failed to initialize background effect.', error);
      this.disabled.add(definition.id);
      this.effect = previousEffect;
      this.currentId = previousId;
      if (!this.effect && definition.id !== 'net') {
        await this.setStyle('net');
      }
    }
  }

  stop(): void {
    this.effect?.destroy();
    this.effect = null;
  }

  private resolveDefinition(styleId: string): BackgroundDefinition | undefined {
    const requested = getBackgroundDefinition(styleId);
    if (requested && !this.disabled.has(requested.id)) return requested;

    const fallback = getBackgroundDefinition('net');
    if (fallback && !this.disabled.has(fallback.id)) return fallback;

    return backgroundCatalog.find((item) => !this.disabled.has(item.id));
  }
}
