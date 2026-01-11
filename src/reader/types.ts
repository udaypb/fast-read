export type Token = {
  text: string;
  isPunctuation: boolean;
};

export type Frame = {
  index: number;
  tokens: Token[];
  text: string;
};

export type ReaderState = {
  isPlaying: boolean;
  currentIndex: number;
  wpm: number;
  totalFrames: number;
};
