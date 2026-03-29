import type { Frame, Token } from '../reader/types';

type ProcessRequest = {
  requestId: string;
  text: string;
  chunkSize: number;
};

type ProcessResponse = {
  requestId: string;
  frames: Frame[];
  wordCount: number;
};

function tokenize(text: string): Token[] {
  const parts = text.match(/\w+|[^\w\s]/g) ?? [];
  return parts.map((part) => ({
    text: part,
    isPunctuation: /^[^\w\s]+$/.test(part)
  }));
}

function frameText(tokens: Token[]): string {
  let output = '';
  tokens.forEach((token, index) => {
    if (index > 0 && !token.isPunctuation) output += ' ';
    output += token.text;
  });
  return output;
}

function toFrames(tokens: Token[], chunkSize: number): Frame[] {
  const size = Math.max(1, chunkSize);
  const frames: Frame[] = [];
  for (let i = 0; i < tokens.length; i += size) {
    const slice = tokens.slice(i, i + size);
    frames.push({
      index: frames.length,
      tokens: slice,
      text: frameText(slice)
    });
  }
  return frames;
}

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  const { requestId, text, chunkSize } = event.data;
  const tokens = tokenize(text);
  const frames = toFrames(tokens, chunkSize);
  const response: ProcessResponse = {
    requestId,
    frames,
    wordCount: (text.trim().match(/\S+/g) ?? []).length
  };
  self.postMessage(response);
};
