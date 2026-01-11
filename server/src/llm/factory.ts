import type { LlmClient } from './types';
import { loadLlmConfig } from './config';
import { OpenAiClient } from './openaiClient';
import { PassThroughClient } from './passThrough';

export function createLlmClient(): LlmClient {
  const config = loadLlmConfig();
  if (config.mode === 'openai' && config.openai?.baseUrl && config.openai.model) {
    console.log(`LLM: openai baseUrl=${config.openai.baseUrl} model=${config.openai.model}`);
    return new OpenAiClient(config);
  }
  console.log(`LLM: passthrough mode=${config.mode}`);
  return new PassThroughClient();
}
