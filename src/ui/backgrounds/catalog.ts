import { BackgroundDefinition, VantaEffectFactory, BackgroundType } from './types';

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
    },
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Net'
  },
  {
    id: 'fog',
    label: 'Fog',
    load: wrapEffect(() => import('vanta/dist/vanta.fog.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Fog'
  },
  {
    id: 'waves',
    label: 'Waves',
    load: wrapEffect(() => import('vanta/dist/vanta.waves.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Waves'
  },
  {
    id: 'birds',
    label: 'Birds',
    load: wrapEffect(() => import('vanta/dist/vanta.birds.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Birds'
  },
  {
    id: 'halo',
    label: 'Halo',
    load: wrapEffect(() => import('vanta/dist/vanta.halo.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Halo'
  },
  {
    id: 'globe',
    label: 'Globe',
    load: wrapEffect(() => import('vanta/dist/vanta.globe.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Globe'
  },
  {
    id: 'rings',
    label: 'Rings',
    load: wrapEffect(() => import('vanta/dist/vanta.rings.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Rings'
  },
  {
    id: 'cells',
    label: 'Cells',
    load: wrapEffect(() => import('vanta/dist/vanta.cells.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Cells'
  },
  {
    id: 'dots',
    label: 'Dots',
    load: wrapEffect(() => import('vanta/dist/vanta.dots.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Dots'
  },
  {
    id: 'topology',
    label: 'Topology',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('vanta/dist/vanta.topology.min');
    }),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Topology'
  },
  {
    id: 'clouds',
    label: 'Clouds',
    load: wrapEffect(() => import('vanta/dist/vanta.clouds.min')),
    category: 'calming',
    type: BackgroundType.Vanta,
    thumbnail: 'https://placehold.co/120x80/232323/FFF?text=Clouds'
  },
  {
    id: 'stickman',
    label: 'Stickman Party',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('./stickman');
    }),
    category: 'cartoon',
    type: BackgroundType.Custom,
    thumbnail: 'https://placehold.co/120x80/444/FFF?text=Stickman'
  },
  {
    id: 'blobs',
    label: 'Bouncing Blobs',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('./blobs');
    }),
    category: 'cartoon',
    type: BackgroundType.Custom,
    thumbnail: 'https://placehold.co/120x80/444/FFF?text=Blobs'
  },
  {
    id: 'rain',
    label: 'Purple Rain',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('./rain');
    }),
    category: 'cartoon',
    type: BackgroundType.Custom,
    thumbnail: 'https://placehold.co/120x80/444/FFF?text=Rain'
  },
  // Satisfying Videos
  {
    id: 'satisfying_1',
    label: 'Sand',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/satisfying_1.mp4',
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/d4a373/FFF?text=Sand'
  },
  {
    id: 'satisfying_2',
    label: 'Colors',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/color_low.mp4',
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/d4a373/FFF?text=Colors'
  },
  {
    id: 'satisfying_3',
    label: 'Kinetic',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/satisfying_2.mp4',
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/d4a373/FFF?text=Kinetic'
  },
  {
    id: 'satisfying_4',
    label: 'Flow',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/satisfying_3.mp4',
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/d4a373/FFF?text=Flow'
  },

  // Subway Surfers
  {
    id: 'subway_1',
    label: 'Subway 1',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/subway_surfer_1.mp4',
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/e76f51/FFF?text=Run1'
  },
  {
    id: 'subway_2',
    label: 'Subway 2',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/subway_surfer_2.mp4',
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/e76f51/FFF?text=Run2'
  },
  {
    id: 'subway_3',
    label: 'Subway 3',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/subway_surfer_3.mp4',
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/e76f51/FFF?text=Run3'
  },
  {
    id: 'subway_4',
    label: 'Subway 4',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/subway_surfer_4.mp4',
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/e76f51/FFF?text=Run4'
  },

  // Minecraft
  {
    id: 'minecraft_1',
    label: 'Parkour 1',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/minecraft_1.mp4',
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/264653/FFF?text=MC1'
  },
  {
    id: 'minecraft_2',
    label: 'Parkour 2',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/minecraft_2.mp4',
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/264653/FFF?text=MC2'
  },
  {
    id: 'minecraft_5',
    label: 'Parkour 3',
    type: BackgroundType.Video,
    url: 'https://pub-8a076bf1fd41463dbb695d05492a7ac0.r2.dev/minecraft_5.mp4',
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/264653/FFF?text=MC3'
  },

  {
    id: 'intro',
    label: 'Welcome',
    load: wrapEffect(async () => {
      await ensureP5();
      return import('./dotWave');
    }),
    category: 'intro',
    type: BackgroundType.Custom,
    thumbnail: 'https://placehold.co/120x80/FFF/000?text=Welcome'
  },
  // Temple Run (Keeping placeholder for now)
  {
    id: 'temple_1',
    label: 'Temple Run',
    type: BackgroundType.Video,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    category: 'temple',
    thumbnail: 'https://placehold.co/120x80/2a9d8f/FFF?text=Temple'
  }
];

export function getBackgroundDefinition(id: string): BackgroundDefinition | undefined {
  return backgroundCatalog.find((item) => item.id === id);
}
