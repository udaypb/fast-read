import * as THREE from 'three';
import { backgroundCatalog, getBackgroundDefinition } from './backgrounds/catalog';
import type { BackgroundDefinition, VantaEffect } from './backgrounds/types';

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
    let factory;
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

    if (token !== this.loadToken) return;

    try {
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
