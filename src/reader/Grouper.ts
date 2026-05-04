import type { Frame, Token } from './types';

const MIN_CHUNK_SIZE = 1;
const MAX_CHUNK_SIZE = 4;

function clampChunkSize(chunkSize: number): number {
  const rounded = Math.round(chunkSize);
  return Math.min(Math.max(rounded, MIN_CHUNK_SIZE), MAX_CHUNK_SIZE);
}

export function groupTokens(tokens: Token[], chunkSize = 3): Frame[] {
  const frames: Frame[] = [];
  let index = 0;
  const size = clampChunkSize(chunkSize);

  while (index < tokens.length) {
    const slice = tokens.slice(index, index + size);
    const startTokenIndex = index;
    const endTokenIndex = index + slice.length - 1;

    frames.push({
      index: frames.length,
      tokens: slice,
      text: slice.map((token) => token.text).join(' '),
      startTokenIndex,
      endTokenIndex
    });

    index += size;
  }

  return frames;
}
