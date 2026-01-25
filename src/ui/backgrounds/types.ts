import type * as THREE from 'three';

export type VantaEffect = {
  destroy: () => void;
};

export type VantaOptions = {
  el: HTMLElement;
  THREE: typeof THREE;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  backgroundColor?: number;
  color?: number;
  color2?: number;
  [key: string]: unknown;
};

export type VantaEffectFactory = (options: Record<string, unknown>) => VantaEffect;

export enum BackgroundType {
  Custom = 'custom',
  Vanta = 'vanta',
  Video = 'video'
}

export type BackgroundDefinition = {
  id: string;
  label: string;
  type: BackgroundType;
  load?: () => Promise<VantaEffectFactory>; // For vanta/p5
  url?: string; // For image/video
  thumbnail?: string;
  options?: Record<string, unknown>;
  category?: 'calming' | 'cartoon' | 'real' | 'satisfying' | 'subway' | 'temple' | 'minecraft' | 'intro';
  textTone?: 'light' | 'dark';
};
