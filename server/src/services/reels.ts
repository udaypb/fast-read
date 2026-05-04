import type { CharacterLine, CharacterSide, DocRecord, Reel } from '../types.js';
import type { BackgroundSpec } from './backgrounds.js';
import { getBackgroundCatalog } from './backgrounds.js';
import { splitWords } from './text.js';

const TARGET_WPM = 250;
const MIN_WORDS = 90;
const TARGET_WORDS = 140;
const MAX_WORDS = 180;

function estimateDuration(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / (TARGET_WPM / 60)));
}

function createTitle(text: string): string {
  const words = splitWords(text);
  const slice = words.slice(0, 8).join(' ');
  return words.length > 8 ? `${slice}...` : slice || 'Untitled';
}

function pickBackground(index: number, catalog: BackgroundSpec[]): BackgroundSpec {
  if (catalog.length > 0) {
    return catalog[index % catalog.length];
  }

  return {
    id: 'net',
    module: 'vanta.net',
    label: 'Net',
    description: 'Connected lines and nodes, calm and structured.',
    moodTags: ['calm', 'focused', 'clean', 'tech'],
    intensity: 2,
    motion: 'slow',
    palette: 'mono',
    keywords: ['calm', 'focused', 'clean', 'tech'],
    notes: 'Fallback background.'
  };
}

const DEFAULT_CHARACTER_ASSETS = [
  {
    id: 'character1',
    uri: 'https://example-bucket/character1.svg',
    side: 'left' as const,
    label: 'Character 1'
  },
  {
    id: 'character2',
    uri: 'https://example-bucket/character2.svg',
    side: 'right' as const,
    label: 'Character 2'
  }
];

function buildMechanicalScript(text: string): CharacterLine[] {
  const sentences = text
    .match(/[^.!?]+[.!?]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
  const lines = sentences.length > 0 ? sentences : [text.trim()].filter(Boolean);

  return lines.map((line, index) => ({
    characterId: index % 2 === 0 ? 'character1' : 'character2',
    text: line,
    side: (index % 2 === 0 ? 'left' : 'right') as CharacterSide
  }));
}

function buildChunks(words: string[], targetSize: number): Array<{
  text: string;
  size: number;
  start: number;
  end: number;
  index: number;
}> {
  const chunks: Array<{ text: string; size: number; start: number; end: number; index: number }> = [];

  let index = 0;
  let tokenCursor = 0;

  while (index < words.length) {
    const remaining = words.length - index;
    let size = remaining;

    if (remaining > targetSize) {
      size = Math.min(targetSize, MAX_WORDS);
      const remainder = remaining - size;
      if (remainder > 0 && remainder < MIN_WORDS) {
        size = Math.max(MIN_WORDS, remaining - MIN_WORDS);
      }
    }

    const chunkWords = words.slice(index, index + size);
    chunks.push({
      text: chunkWords.join(' '),
      size,
      start: tokenCursor,
      end: tokenCursor + size - 1,
      index: chunks.length
    });

    index += size;
    tokenCursor += size;
  }

  return chunks;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function buildReels(options: {
  docId: string;
  text: string;
  chunkSize?: number;
  createdAt: string;
  version: number;
  onReel?: (reel: Reel) => void;
}): Promise<Reel[]> {
  const words = splitWords(options.text);
  const backgroundCatalog = getBackgroundCatalog();
  const chunkSize = Math.max(MIN_WORDS, options.chunkSize ?? TARGET_WORDS);
  const chunks = buildChunks(words, chunkSize);
  const reels: Reel[] = [];

  for (const chunk of chunks) {
    const reelText = chunk.text.trim();
    const wordCount = splitWords(reelText).length;
    const background = pickBackground(chunk.index, backgroundCatalog);

    const reel: Reel = {
      docId: options.docId,
      reelId: `${options.docId}-${chunk.index}`,
      index: chunk.index,
      title: createTitle(reelText),
      text: reelText,
      characterAssets: DEFAULT_CHARACTER_ASSETS,
      characterScript: buildMechanicalScript(reelText),
      backgroundId: background.id,
      backgroundModule: background.module,
      backgroundLabel: background.label,
      backgroundDescription: background.description,
      backgroundMoodTags: background.moodTags,
      backgroundIntensity: background.intensity,
      backgroundMotion: background.motion,
      backgroundPalette: background.palette,
      backgroundNotes: background.notes,
      tokenStart: chunk.start,
      tokenEnd: chunk.end,
      wordCount,
      estDurationSec: estimateDuration(wordCount),
      createdAt: options.createdAt,
      version: options.version
    };

    reels.push(reel);
    options.onReel?.(reel);
    await yieldToEventLoop();
  }

  return reels;
}

export function createDocRecord(options: {
  docId: string;
  text: string;
  reels: Reel[];
  createdAt: string;
  version: number;
  state: 'processing' | 'ready' | 'error';
  error?: string;
}): DocRecord {
  return {
    docId: options.docId,
    text: options.text,
    reels: options.reels,
    createdAt: options.createdAt,
    version: options.version,
    state: options.state,
    error: options.error
  };
}
