import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export type LlmConfig = {
  mode: 'passthrough' | 'openai';
  openai?: {
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
  };
  prompts?: {
    condense?: string;
    analyze?: string;
  };
};

const DEFAULT_CONFIG: LlmConfig = {
  mode: 'passthrough'
};

export function loadLlmConfig(): LlmConfig {
  const configPath = resolveConfigPath();
  if (!configPath) return { ...DEFAULT_CONFIG };

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = parse(raw) as LlmConfig;
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_CONFIG };
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    console.warn('Failed to load LLM config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

function resolveConfigPath(): string | null {
  const explicit = process.env.LLM_CONFIG_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'config/llm.yaml'),
    path.resolve(cwd, 'server/config/llm.yaml')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}
