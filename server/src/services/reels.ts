import type { DocRecord, Reel } from '../types';
import type { LlmClient } from '../llm/types';
import type { BackgroundSpec } from './backgrounds';
import { getBackgroundCatalog, getBackgroundCatalogSummary } from './backgrounds';
import { splitWords } from './text';

const TARGET_WPM = 300;
const MIN_WORDS = 150;
const TARGET_WORDS = 300;
const MAX_WORDS = 450;

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

  // TODO this needs to be sentiment aware, so we need to connect to the LLM module we have and analyze the text
  return {
    id: 'net',
    module: 'vanta.net',
    label: 'Net',
    description: 'Connected lines and nodes, calm and structured.',
    moodTags: ['calm', 'focused', 'clean', 'tech'],
    intensity: 2,
    motion: 'slow',
    palette: 'mono',
    notes: 'Fallback background.'
  };
}

const SENTIMENT_GROUPS: Record<string, string[]> = {
  positive: ['birds', 'halo', 'waves'],
  negative: ['fog', 'cells', 'topology'],
  neutral: ['net', 'rings', 'dots', 'globe']
};

function normalizeKey(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withoutIndex = trimmed.replace(/^\d+\s*[\).:-]?\s*/g, '');
  const parenMatch = withoutIndex.match(/\(([^)]+)\)/);
  const candidate = parenMatch ? parenMatch[1] : withoutIndex;
  return candidate.replace(/\s+/g, ' ').trim();
}

function matchBackgroundByKey(key: string, catalog: BackgroundSpec[]): BackgroundSpec | null {
  const normalized = normalizeKey(key);
  const match = catalog.find((item) =>
    normalizeKey(item.id) === normalized || normalizeKey(item.label) === normalized
  );
  return match ?? null;
}

function pickBackgroundById(backgroundId: string | undefined, catalog: BackgroundSpec[]): BackgroundSpec | null {
  if (!backgroundId) return null;
  return matchBackgroundByKey(backgroundId, catalog);
}

function pickBackgroundFromTags(
  tags: string[] | undefined,
  catalog: BackgroundSpec[],
  index: number
): BackgroundSpec | null {
  if (!tags || tags.length === 0) return null;
  const normalizedTags = tags.map((tag) => normalizeKey(tag));
  let bestScore = 0;
  let bestMatches: BackgroundSpec[] = [];

  for (const background of catalog) {
    const keywords = background.keywords.map((keyword) => normalizeKey(keyword));
    const score = normalizedTags.reduce((total, tag) => total + (keywords.includes(tag) ? 1 : 0), 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatches = [background];
    } else if (score > 0 && score === bestScore) {
      bestMatches.push(background);
    }
  }

  if (bestScore === 0) return null;
  if (bestMatches.length === 1) return bestMatches[0];
  return bestMatches[index % bestMatches.length] ?? null;
}

function pickBackgroundBySentiment(
  sentiment: string | undefined,
  catalog: BackgroundSpec[],
  index: number
): BackgroundSpec | null {
  if (!sentiment) return null;
  const normalized = sentiment.toLowerCase();
  const key =
    normalized.includes('positive') ? 'positive' :
    normalized.includes('negative') ? 'negative' :
    normalized.includes('neutral') ? 'neutral' :
    null;

  if (!key) return null;
  const group = SENTIMENT_GROUPS[key];
  if (!group || group.length === 0) return null;

  const candidateId = group[index % group.length];
  return pickBackgroundById(candidateId, catalog);
}

function selectBackground(
  analysis: { sentiment?: string; tags?: string[]; backgroundId?: string; backgroundName?: string },
  catalog: BackgroundSpec[],
  index: number
): BackgroundSpec {
  const byId = pickBackgroundById(analysis.backgroundId, catalog);
  if (byId) return byId;

  const byName = pickBackgroundById(analysis.backgroundName, catalog);
  if (byName) return byName;

  const byTags = pickBackgroundFromTags(analysis.tags, catalog, index);
  if (byTags) return byTags;

  const bySentiment = pickBackgroundBySentiment(analysis.sentiment, catalog, index);
  if (bySentiment) return bySentiment;

  return pickBackground(index, catalog);
}

async function analyzeReel(
  text: string,
  llm: LlmClient,
  backgroundSummary: string
): Promise<{ sentiment?: string; tags?: string[]; backgroundId?: string; backgroundName?: string; reason?: string }> {
  try {
    const result = await llm.analyze({ text, backgroundSummary });
    return {
      sentiment: result.sentiment,
      tags: result.tags,
      backgroundId: result.backgroundId,
      backgroundName: result.backgroundName,
      reason: result.reason
    };
  } catch (error) {
    console.warn('LLM analysis failed, using defaults.', error);
    return { sentiment: 'neutral', tags: [] };
  }
}

export async function buildReels(options: {
  docId: string;
  text: string;
  llm: LlmClient;
  createdAt: string;
  version: number;
}): Promise<Reel[]> {
  const words = splitWords(options.text);
  const reels: Reel[] = [];
  const backgroundCatalog = getBackgroundCatalog();
  const backgroundSummary = getBackgroundCatalogSummary();
  let index = 0;
  let tokenCursor = 0;

  while (index < words.length) {
    const remaining = words.length - index;
    let size = remaining;

    if (remaining > TARGET_WORDS) {
      size = Math.min(TARGET_WORDS, MAX_WORDS);
      const remainder = remaining - size;
      if (remainder > 0 && remainder < MIN_WORDS) {
        size = Math.max(MIN_WORDS, remaining - MIN_WORDS);
      }
    } else if (remaining < MIN_WORDS && reels.length > 0) {
      const previous = reels[reels.length - 1];
      const extraWords = words.slice(index).join(' ');
      previous.text = `${previous.text} ${extraWords}`.trim();
      const updatedWordCount = splitWords(previous.text).length;
      previous.wordCount = updatedWordCount;
      previous.estDurationSec = estimateDuration(updatedWordCount);
      previous.tokenEnd = tokenCursor + remaining - 1;
      break;
    }

    const chunkWords = words.slice(index, index + size);
    const chunkText = chunkWords.join(' ');
    const tokenStart = tokenCursor;
    const tokenEnd = tokenCursor + size - 1;
    const condensed = await options.llm.condense({
      text: chunkText,
      targetWords: size
    });
    const reelText = condensed.text.trim();
    const wordCount = splitWords(reelText).length;
    const analysis = await analyzeReel(reelText, options.llm, backgroundSummary);
    const background = selectBackground(analysis, backgroundCatalog, reels.length);
    const reel: Reel = {
      docId: options.docId,
      reelId: `${options.docId}-${reels.length}`,
      index: reels.length,
      title: createTitle(reelText),
      text: reelText,
      backgroundId: background.id,
      backgroundModule: background.module,
      backgroundLabel: background.label,
      backgroundDescription: background.description,
      backgroundMoodTags: background.moodTags,
      backgroundIntensity: background.intensity,
      backgroundMotion: background.motion,
      backgroundPalette: background.palette,
      backgroundNotes: background.notes,
      sentiment: analysis.sentiment,
      analysisTags: analysis.tags,
      analysisBackgroundId: analysis.backgroundId,
      analysisBackgroundName: analysis.backgroundName,
      analysisReason: analysis.reason,
      tokenStart,
      tokenEnd,
      wordCount,
      estDurationSec: estimateDuration(wordCount),
      createdAt: options.createdAt,
      version: options.version
    };

    reels.push(reel);
    index += size;
    tokenCursor += size;
  }

  return reels;
}

export function createDocRecord(options: {
  docId: string;
  text: string;
  reels: Reel[];
}): DocRecord {
  return {
    docId: options.docId,
    text: options.text,
    reels: options.reels,
    createdAt: new Date().toISOString(),
    version: 1
  };
}
