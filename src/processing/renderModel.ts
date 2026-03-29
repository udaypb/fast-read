import type { Reel } from '../api/types';
import type { Frame } from '../reader/types';

export type LocalRenderModel = {
  reels: Reel[];
  reelFramesById: Map<string, Frame[]>;
};

const FRAMES_PER_REEL = 40;

export function createLocalRenderModel(docId: string, frames: Frame[]): LocalRenderModel {
  const reels: Reel[] = [];
  const reelFramesById = new Map<string, Frame[]>();
  const createdAt = new Date().toISOString();

  for (let i = 0; i < frames.length; i += FRAMES_PER_REEL) {
    const reelFrames = frames.slice(i, i + FRAMES_PER_REEL);
    const reelIndex = reels.length;
    const reelId = `${docId}-reel-${reelIndex + 1}`;
    const text = reelFrames.map((frame) => frame.text).join(' ').replace(/\s+/g, ' ').trim();

    reelFramesById.set(reelId, reelFrames.map((frame, frameIndex) => ({ ...frame, index: frameIndex })));

    reels.push({
      docId,
      reelId,
      index: reelIndex,
      title: `Reel ${reelIndex + 1}`,
      text,
      backgroundId: 'net',
      backgroundModule: 'vanta',
      backgroundLabel: 'Net',
      backgroundDescription: 'Calming animated background',
      backgroundMoodTags: ['calm'],
      backgroundIntensity: 30,
      backgroundMotion: 'smooth',
      backgroundPalette: 'dark',
      backgroundNotes: 'Local frontend render model',
      wordCount: text ? text.split(/\s+/).length : 0,
      estDurationSec: Math.max(1, Math.round((text ? text.split(/\s+/).length : 0) / 5)),
      createdAt,
      version: 1
    });
  }

  return { reels, reelFramesById };
}
