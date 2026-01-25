export type Difficulty = 'easy' | 'medium' | 'hard';

export type CharacterSide = 'left' | 'right';

export type CharacterAsset = {
  id: string;
  uri: string;
  side: CharacterSide;
  label?: string;
};

export type CharacterLine = {
  characterId: string;
  text: string;
  side?: CharacterSide;
  assetUri?: string;
};

export type Reel = {
  docId: string;
  reelId: string;
  index: number;
  title: string;
  text: string;
  characterAssets?: CharacterAsset[];
  characterScript?: CharacterLine[];
  backgroundId: string;
  backgroundModule: string;
  backgroundLabel: string;
  backgroundDescription: string;
  backgroundMoodTags: string[];
  backgroundIntensity: number;
  backgroundMotion: string;
  backgroundPalette: string;
  backgroundNotes: string;
  sentiment?: string;
  analysisTags?: string[];
  analysisBackgroundId?: string;
  analysisBackgroundName?: string;
  analysisReason?: string;
  tokenStart?: number;
  tokenEnd?: number;
  pageStart?: number;
  pageEnd?: number;
  wordCount: number;
  estDurationSec: number;
  difficulty?: Difficulty;
  tags?: string[];
  createdAt: string;
  version: number;
};

export type ReelPage = {
  docId: string;
  totalReels: number;
  offset: number;
  limit: number;
  reels: Reel[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export type DocStatus = {
  state: 'processing' | 'ready' | 'error';
  totalReels?: number;
  processedReels?: number;
};

export type DocCreateResponse = {
  docId: string;
};
