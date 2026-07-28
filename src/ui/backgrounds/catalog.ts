import { BackgroundDefinition, VantaEffectFactory, BackgroundType } from './types';

type VantaModule = { default?: unknown };
const DEFAULT_BACKGROUND_ASSET_BASE_URL = 'https://readfast-live-backgrounds-598886662694.s3.us-east-1.amazonaws.com';
const BACKGROUND_ASSET_BASE_URL =
  (import.meta.env.VITE_BACKGROUND_ASSET_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  DEFAULT_BACKGROUND_ASSET_BASE_URL;

const BACKGROUND_TEXT_TONES: Record<string, 'light' | 'dark'> = {
  net: 'light',
  fog: 'light',
  waves: 'light',
  birds: 'light',
  halo: 'light',
  globe: 'light',
  rings: 'light',
  cells: 'light',
  dots: 'light',
  topology: 'light',
  clouds: 'light',
  stickman: 'light',
  blobs: 'light',
  rain: 'light',
  neon_tunnel: 'light',
  particle_bloom: 'light',
  light_corridor: 'light',
  wire_tunnel: 'light',
  mandala: 'dark',
  galaxy_core: 'light',
  aurora_lake: 'light',
  nebula_cloud: 'light',
  deep_space: 'light',
  subway_1: 'light',
  subway_2: 'dark',
  subway_3: 'light',
  subway_4: 'dark',
  china_surfer: 'light',
  minecraft_1: 'dark',
  minecraft_3: 'dark',
  minecraft_4: 'light',
  minecraft_6: 'dark',
  minecraft_night: 'light',
  intro: 'dark',
  racing_future: 'dark',
  racing_stadium: 'dark',
  fortnite_ridge: 'dark',
  fortnite_corridor: 'dark',
  fortnite_night: 'light',
  fortnite_neon_dash: 'light',
  fortnite_build: 'dark',
  ocean_coast: 'light',
  leaf_macro: 'dark'
};

function backgroundAssetUrl(fileName: string): string {
  const path = fileName
    .replace(/^\//, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${BACKGROUND_ASSET_BASE_URL}/${path}`;
}

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
  // Satisfying and space loops
  {
    id: 'neon_tunnel',
    label: 'Neon Tunnel',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('abstract_6.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/222/FFF?text=Tunnel'
  },
  {
    id: 'particle_bloom',
    label: 'Particle Bloom',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('abstract_4.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/2f225a/FFF?text=Bloom'
  },
  {
    id: 'light_corridor',
    label: 'Light Corridor',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('abstract_1.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/111/FFF?text=Light'
  },
  {
    id: 'wire_tunnel',
    label: 'Wire Tunnel',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('abstract_3_fast.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/18124a/FFF?text=Wire'
  },
  {
    id: 'mandala',
    label: 'Mandala',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('abstract_mandala.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/7420a8/FFF?text=Mandala',
    textTone: 'dark'
  },
  {
    id: 'galaxy_core',
    label: 'Galaxy Core',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('space_4.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/3a1b27/FFF?text=Galaxy'
  },
  {
    id: 'aurora_lake',
    label: 'Aurora Lake',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('space_6.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/102a35/FFF?text=Aurora'
  },
  {
    id: 'nebula_cloud',
    label: 'Nebula Cloud',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('space_2.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/1c2447/FFF?text=Nebula'
  },
  {
    id: 'deep_space',
    label: 'Deep Space',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('space_1.mp4'),
    category: 'satisfying',
    thumbnail: 'https://placehold.co/120x80/100e13/FFF?text=Space'
  },

  // Subway Surfers
  {
    id: 'subway_1',
    label: 'Tunnel Run',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('subway_surfer_1_fast.mp4'),
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/3a6b28/FFF?text=Tunnel'
  },
  {
    id: 'subway_2',
    label: 'Classic Run',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('subway_surfer_2_fast.mp4'),
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/e76f51/FFF?text=Classic'
  },
  {
    id: 'subway_3',
    label: 'Night Tracks',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('subway_surfer_3_fast.mp4'),
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/163c3f/FFF?text=Night'
  },
  {
    id: 'subway_4',
    label: 'Forest Rails',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('subway_surfer_4_fast.mp4'),
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/6b9d28/FFF?text=Forest'
  },
  {
    id: 'china_surfer',
    label: 'China Runner',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('china_surfer_low_fast.mp4'),
    category: 'subway',
    thumbnail: 'https://placehold.co/120x80/a42525/FFF?text=China'
  },

  // Minecraft
  {
    id: 'minecraft_1',
    label: 'Village Parkour',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('minecraft_1.mp4'),
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/6e8c3a/FFF?text=Village'
  },
  {
    id: 'minecraft_3',
    label: 'Sunset Blocks',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('minecraft_3.mp4'),
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/b37d50/FFF?text=Sunset'
  },
  {
    id: 'minecraft_4',
    label: 'Cave Lantern',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('minecraft_4.mp4'),
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/4c4035/FFF?text=Cave'
  },
  {
    id: 'minecraft_6',
    label: 'Bamboo Canyon',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('minecraft_6_fast.mp4'),
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/b4552e/FFF?text=Canyon',
    textTone: 'dark'
  },
  {
    id: 'minecraft_night',
    label: 'Night Bridge',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('minecraft_night_bridge.mp4'),
    category: 'minecraft',
    thumbnail: 'https://placehold.co/120x80/14212d/FFF?text=Night'
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
    thumbnail: 'https://placehold.co/120x80/FFF/000?text=Welcome',
    textTone: 'dark'
  },
  // Racing/action clips. The category id remains "temple" so older saved settings still resolve.
  {
    id: 'racing_future',
    label: 'Future Track',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('track_video.mp4'),
    category: 'temple',
    thumbnail: 'https://placehold.co/120x80/9fb7c5/000?text=Future',
    textTone: 'dark'
  },
  {
    id: 'racing_stadium',
    label: 'Stadium Track',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('track.mp4'),
    category: 'temple',
    thumbnail: 'https://placehold.co/120x80/6da578/FFF?text=Track',
    textTone: 'dark'
  },
  {
    id: 'fortnite_ridge',
    label: 'Ridge Drive',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('fortnite_1.mp4'),
    category: 'fortnite',
    thumbnail: 'https://placehold.co/120x80/6a79a8/FFF?text=Drive'
  },
  {
    id: 'fortnite_corridor',
    label: 'Green Corridor',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('fortnite_2.mp4'),
    category: 'fortnite',
    thumbnail: 'https://placehold.co/120x80/7ac66a/000?text=Corridor',
    textTone: 'dark'
  },
  {
    id: 'fortnite_night',
    label: 'Night Elims',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('fortnite_3.mp4'),
    category: 'fortnite',
    thumbnail: 'https://placehold.co/120x80/12304b/FFF?text=Night'
  },
  {
    id: 'fortnite_neon_dash',
    label: 'Neon Dash',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('fortnite_neon_dash.mp4'),
    category: 'fortnite',
    thumbnail: 'https://placehold.co/120x80/2b1f69/FFF?text=Neon'
  },
  {
    id: 'fortnite_build',
    label: 'Build Run',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('fortnite_4.mp4'),
    category: 'fortnite',
    thumbnail: 'https://placehold.co/120x80/c5a46d/000?text=Build',
    textTone: 'dark'
  },
  {
    id: 'ocean_coast',
    label: 'Ocean Coast',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('ocean_coast.mp4'),
    category: 'real',
    thumbnail: 'https://placehold.co/120x80/426a6f/FFF?text=Ocean'
  },
  {
    id: 'leaf_macro',
    label: 'Leaf Macro',
    type: BackgroundType.Video,
    url: backgroundAssetUrl('leaf_macro.mp4'),
    category: 'real',
    thumbnail: 'https://placehold.co/120x80/4c8a3f/FFF?text=Leaf',
    textTone: 'dark'
  }
];

export function getBackgroundDefinition(id: string): BackgroundDefinition | undefined {
  return backgroundCatalog.find((item) => item.id === id);
}

export function getBackgroundTextTone(id: string): 'light' | 'dark' {
  const tone = BACKGROUND_TEXT_TONES[id];
  if (tone) return tone;

  const definition = getBackgroundDefinition(id);
  if (definition?.textTone) return definition.textTone;

  const thumbnailHex = definition?.thumbnail?.match(/placehold\.co\/\d+x\d+\/([0-9a-fA-F]{3,6})\//)?.[1];
  if (!thumbnailHex) return 'light';

  const normalized = thumbnailHex.length === 3
    ? thumbnailHex.split('').map((char) => `${char}${char}`).join('')
    : thumbnailHex;

  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);

  return luminance > 0.46 ? 'dark' : 'light';
}
