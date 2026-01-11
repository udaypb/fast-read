import pdfParse from 'pdf-parse';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { toString } from 'mdast-util-to-string';
import type { Code, Content, List, Root } from 'mdast';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text ?? '';
}

export function normalizeText(raw: string): string {
  const cleaned = normalizeRawText(raw);
  if (!cleaned) return '';

  try {
    const paragraphs = extractParagraphs(cleaned);
    if (paragraphs.length > 0) {
      return paragraphs.join('\n\n');
    }
  } catch (error) {
    console.warn('Text normalization failed, using fallback.', error);
  }

  return fallbackNormalize(cleaned);
}

export function splitWords(text: string): string[] {
  return text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
}

function normalizeRawText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/^\s*[•‣▪◦·–—]\s+/gm, '- ')
    .replace(/^\s*[\*\+]\s+/gm, '- ')
    .replace(/^\s*(\d+)\)\s+/gm, '$1. ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fallbackNormalize(raw: string): string {
  return raw.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractParagraphs(text: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(text) as Root;
  const paragraphs: string[] = [];

  for (const node of tree.children as Content[]) {
    switch (node.type) {
      case 'paragraph':
      case 'heading': {
        pushParagraph(paragraphs, toString(node));
        break;
      }
      case 'list': {
        const paragraph = listToParagraph(node as List);
        if (paragraph) paragraphs.push(paragraph);
        break;
      }
      case 'code': {
        const codeNode = node as Code;
        const codeValue = typeof codeNode.value === 'string' ? codeNode.value : '';
        const normalized = normalizeParagraph(codeValue);
        if (normalized) paragraphs.push(`Code: ${normalized}`);
        break;
      }
      case 'blockquote': {
        const quote = normalizeParagraph(toString(node));
        if (quote) paragraphs.push(`Quote: ${quote}`);
        break;
      }
      case 'thematicBreak':
        break;
      default: {
        pushParagraph(paragraphs, toString(node));
        break;
      }
    }
  }

  return paragraphs;
}

function listToParagraph(list: List): string | null {
  const sentences = list.children
    .map((item) => normalizeParagraph(toString(item)))
    .filter(Boolean)
    .map((text) => ensureSentence(text));

  if (sentences.length === 0) return null;
  return sentences.join(' ');
}

function pushParagraph(target: string[], text: string): void {
  const normalized = normalizeParagraph(text);
  if (normalized) target.push(normalized);
}

function normalizeParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function ensureSentence(text: string): string {
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}
