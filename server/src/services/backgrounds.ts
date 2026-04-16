import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type BackgroundSpec = {
  id: string;
  module: string;
  label: string;
  description: string;
  moodTags: string[];
  keywords: string[];
  intensity: number;
  motion: string;
  palette: string;
  notes: string;
};

const backgroundCatalog = loadBackgroundCatalog();

export function getBackgroundCatalog(): BackgroundSpec[] {
  return backgroundCatalog;
}

export function getBackgroundCatalogSummary(): string {
  const ids = backgroundCatalog.map((item) => item.id).join(', ');
  const lines = backgroundCatalog.map((item) => {
    const tags = item.moodTags.join(', ');
    const keywords = item.keywords.join(', ');
    return `- ${item.id} (${item.label}): ${item.description} Tags: ${tags}. Keywords: ${keywords}. Intensity: ${item.intensity}. Motion: ${item.motion}. Palette: ${item.palette}.`;
  });
  return [
    `Valid background ids: ${ids}. Use one of these exact ids; do not return numbers.`,
    ...lines
  ].join('\n');
}

function loadBackgroundCatalog(): BackgroundSpec[] {
  try {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(dirname, '../metadata/backgrounds.json'),
      path.resolve(dirname, '../../src/metadata/backgrounds.json')
    ];

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as BackgroundSpec[];
      return Array.isArray(parsed) ? parsed : [];
    }

    throw new Error('backgrounds.json not found in expected locations.');
  } catch (error) {
    console.warn('Failed to load background metadata.', error);
    return [];
  }
}
