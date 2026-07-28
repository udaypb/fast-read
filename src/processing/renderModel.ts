import type { Reel } from '../api/types';
import type { Frame } from '../reader/types';
import { backgroundCatalog } from '../ui/backgrounds/catalog';
import { BackgroundType } from '../ui/backgrounds/types';

export type LocalRenderModel = {
  reels: Reel[];
  reelFramesById: Map<string, Frame[]>;
};

const FRAMES_PER_REEL = 40;
const RANDOM_BACKGROUND_CATEGORIES = new Set(['calming']);

const randomBackgrounds = backgroundCatalog.filter((background) => (
  background.category &&
  RANDOM_BACKGROUND_CATEGORIES.has(background.category)
));

function pickRandomBackground(previousId?: string) {
  const candidates = randomBackgrounds.length > 0
    ? randomBackgrounds
    : backgroundCatalog.filter((background) => background.id === 'net');

  if (candidates.length === 0) {
    return backgroundCatalog.find((background) => background.id === 'net') ?? backgroundCatalog[0];
  }

  const usableCandidates = previousId && candidates.length > 1
    ? candidates.filter((background) => background.id !== previousId)
    : candidates;

  return usableCandidates[Math.floor(Math.random() * usableCandidates.length)];
}

export function createLocalRenderModel(docId: string, frames: Frame[]): LocalRenderModel {
  const reels: Reel[] = [];
  const reelFramesById = new Map<string, Frame[]>();
  const createdAt = new Date().toISOString();
  let previousBackgroundId: string | undefined;

  for (let i = 0; i < frames.length; i += FRAMES_PER_REEL) {
    const reelFrames = frames.slice(i, i + FRAMES_PER_REEL);
    const reelIndex = reels.length;
    const reelId = `${docId}-reel-${reelIndex + 1}`;
    const text = reelFrames.map((frame) => frame.text).join(' ').replace(/\s+/g, ' ').trim();
    const background = pickRandomBackground(previousBackgroundId);
    previousBackgroundId = background?.id;

    reelFramesById.set(reelId, reelFrames.map((frame, frameIndex) => ({ ...frame, index: frameIndex })));

    reels.push({
      docId,
      reelId,
      index: reelIndex,
      title: `Reel ${reelIndex + 1}`,
      text,
      backgroundId: background?.id ?? 'net',
      backgroundModule: background?.type ?? 'vanta',
      backgroundLabel: background?.label ?? 'Net',
      backgroundDescription: `${background?.label ?? 'Animated'} reading background`,
      backgroundMoodTags: background?.category ? [background.category] : ['calm'],
      backgroundIntensity: background?.type === BackgroundType.Video ? 65 : 30,
      backgroundMotion: background?.type === BackgroundType.Video ? 'video loop' : 'smooth',
      backgroundPalette: background?.textTone === 'dark' ? 'light' : 'dark',
      backgroundNotes: 'Local frontend render model with randomized background',
      wordCount: text ? text.split(/\s+/).length : 0,
      estDurationSec: Math.max(1, Math.round((text ? text.split(/\s+/).length : 0) / 5)),
      createdAt,
      version: 1
    });
  }

  return { reels, reelFramesById };
}
