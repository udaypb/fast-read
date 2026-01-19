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
  chunkSize?: number;
};

const DEFAULT_CONFIG: LlmConfig = {
  mode: 'passthrough',
  chunkSize: 300
};

export function loadLlmConfig(): LlmConfig {
  const configPath = resolveConfigPath();
  if (!configPath) return applyEnvOverrides({ ...DEFAULT_CONFIG });

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = parse(raw) as LlmConfig;
    if (!parsed || typeof parsed !== 'object') {
      return applyEnvOverrides({ ...DEFAULT_CONFIG });
    }
    return applyEnvOverrides({ ...DEFAULT_CONFIG, ...parsed });
  } catch (error) {
    console.warn('Failed to load LLM config:', error);
    return applyEnvOverrides({ ...DEFAULT_CONFIG });
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

function applyEnvOverrides(config: LlmConfig): LlmConfig {
  const next: LlmConfig = { ...config, openai: config.openai ? { ...config.openai } : undefined } as LlmConfig;

  const mode = process.env.LLM_MODE;
  if (mode === 'openai' || mode === 'passthrough') {
    next.mode = mode;
  }

  const baseUrl = process.env.LLM_BASE_URL;
  if (baseUrl) {
    next.openai = { ...(next.openai ?? {}), baseUrl } as any;
  }

  const model = process.env.LLM_MODEL;
  if (model) {
    next.openai = { ...(next.openai ?? {}), model } as any;
  }

  const apiKey = process.env.LLM_API_KEY;
  if (apiKey !== undefined && apiKey !== '') {
    next.openai = { ...(next.openai ?? {}), apiKey } as any;
  }

  const timeoutRaw = process.env.LLM_TIMEOUT_MS;
  if (timeoutRaw) {
    const timeoutMs = Number(timeoutRaw);
    if (Number.isFinite(timeoutMs)) {
      next.openai = { ...(next.openai ?? {}), timeoutMs } as any;
    }
  }

  const chunkSizeRaw = process.env.LLM_CHUNK_SIZE;
  if (chunkSizeRaw) {
    const size = Number(chunkSizeRaw);
    if (Number.isFinite(size) && size > 0) {
      next.chunkSize = size;
    }
  }

  return next;
}
