import type { Token } from './types';

const PUNCTUATION_RE = /[.,!?;:]$/;

export function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((word) => ({
      text: word,
      isPunctuation: PUNCTUATION_RE.test(word)
    }));
}
