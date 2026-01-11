import type { BackgroundDefinition, VantaEffectFactory } from './types';

type VantaModule = { default?: unknown };

function wrapEffect(load: () => Promise<unknown>): () => Promise<VantaEffectFactory> {
  return async () => {
    const moduleEffect = (await load()) as VantaModule;
    const effect = moduleEffect.default ?? moduleEffect;
    if (typeof effect === 'function') {
      return effect as VantaEffectFactory;
    }
    throw new Error('Vanta effect did not export a callable factory.');
  };
}

async function ensureP5(): Promise<void> {
  if (typeof window === 'undefined') return;
  const win = window as Window & { p5?: unknown };
  if (win.p5) return;
  const module = (await import('p5')) as VantaModule;
  win.p5 = module.default ?? module;
}

export const backgroundCatalog: BackgroundDefinition[] = [
  {
    id: 'net',
    label: 'Net',
    load: wrapEffect(() => import('vanta/dist/vanta.net.min')),
    options: {
      points: 8,
      maxDistance: 22,
      spacing: 18
    }
  },
  {
    id: 'fog',
    label: 'Fog',
    load: wrapEffect(() => import('vanta/dist/vanta.fog.min'))
  },
  {
    id: 'waves',
    label: 'Waves',
    load: wrapEffect(() => import('vanta/dist/vanta.waves.min'))
  },
  {
    id: 'birds',
    label: 'Birds',
    load: wrapEffect(() => import('vanta/dist/vanta.birds.min'))
  },
  {
    id: 'halo',
    label: 'Halo',
    load: wrapEffect(() => import('vanta/dist/vanta.halo.min'))
  },
  {
    id: 'globe',
    label: 'Globe',
    load: wrapEffect(() => import('vanta/dist/vanta.globe.min'))
  },
  {
    id: 'rings',
    label: 'Rings',
    load: wrapEffect(() => import('vanta/dist/vanta.rings.min'))
  },
  {
    id: 'cells',
    label: 'Cells',
    load: wrapEffect(() => import('vanta/dist/vanta.cells.min'))
  },
  {
    id: 'dots',
    label: 'Dots',
    load: wrapEffect(() => import('vanta/dist/vanta.dots.min'))
  },
  {
    id: 'topology',
    label: 'Topology',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('vanta/dist/vanta.topology.min');
    })
  }
];

export function getBackgroundDefinition(id: string): BackgroundDefinition | undefined {
  return backgroundCatalog.find((item) => item.id === id);
}
