export type Token = {
  text: string;
  isPunctuation: boolean;
};

export type CharacterSide = 'left' | 'right';

export type Frame = {
  index: number;
  tokens: Token[];
  text: string;
  startTokenIndex: number;
  endTokenIndex: number;
  characterId?: string;
  characterSide?: CharacterSide;
  characterAssetUri?: string;
};

export type ReaderState = {
  isPlaying: boolean;
  currentIndex: number;
  wpm: number;
  totalFrames: number;
};
