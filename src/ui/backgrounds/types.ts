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

export type VantaEffectFactory = (options: VantaOptions) => VantaEffect;

export type BackgroundDefinition = {
  id: string;
  label: string;
  load: () => Promise<VantaEffectFactory>;
  options?: Record<string, unknown>;
};
