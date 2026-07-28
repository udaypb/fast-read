import type { Frame, Token } from '../reader/types';

const LONG_DASH_RE = /[\u2010-\u2015]/g;
const HTML_ESCAPE_RE = /[&<>"']/g;

function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_RE, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function getReadableLength(text: string): number {
  return Array.from(text.replace(LONG_DASH_RE, '-')).length;
}

function getFocusTokenIndex(tokens: Token[]): number {
  if (tokens.length <= 1) {
    return 0;
  }

  const totalLength = tokens.reduce((sum, token) => sum + getReadableLength(token.text), 0);
  let walkedLength = 0;
  const midpoint = totalLength / 2;

  for (let i = 0; i < tokens.length; i += 1) {
    walkedLength += getReadableLength(tokens[i].text);
    if (walkedLength >= midpoint) {
      return i;
    }
  }

  return Math.floor(tokens.length / 2);
}

function getAnchorIndex(text: string): number {
  const chars = Array.from(text);
  const letterIndexes = chars
    .map((char, index) => (/\p{L}|\p{N}/u.test(char) ? index : -1))
    .filter((index) => index >= 0);

  if (letterIndexes.length === 0) {
    return Math.max(0, Math.floor(chars.length / 2));
  }

  const readableLength = letterIndexes.length;
  const ratio = readableLength <= 1
    ? 0
    : readableLength <= 5
      ? 0.5
      : readableLength <= 9
        ? 0.42
        : 0.35;
  const anchorPosition = Math.min(letterIndexes.length - 1, Math.floor(readableLength * ratio));

  return letterIndexes[anchorPosition];
}

function renderFocusWord(token: Token): string {
  const chars = Array.from(token.text);
  if (chars.length === 0) {
    return '';
  }

  const anchorIndex = getAnchorIndex(token.text);
  return chars
    .map((char, index) => {
      const escaped = escapeHtml(char);
      return index === anchorIndex
        ? `<span class="reading-focus-anchor">${escaped}</span>`
        : escaped;
    })
    .join('');
}

export function renderFrameWithFocusAnchor(frame: Frame | null): string {
  if (!frame || frame.tokens.length === 0) {
    return '';
  }

  const focusIndex = getFocusTokenIndex(frame.tokens);
  return frame.tokens
    .map((token, index) => {
      const tokenHtml = index === focusIndex ? renderFocusWord(token) : escapeHtml(token.text);
      return `<span class="reading-focus-token${index === focusIndex ? ' reading-focus-token--active' : ''}">${tokenHtml}</span>`;
    })
    .join('<span class="reading-focus-space"> </span>');
}
