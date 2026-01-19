import type { LlmClient } from './types.js';
import { loadLlmConfig } from './config.js';
import { OpenAiClient } from './openaiClient.js';
import { PassThroughClient } from './passThrough.js';

export function createLlmClient(): LlmClient {
  const config = loadLlmConfig();
  if (config.mode === 'openai' && config.openai?.baseUrl && config.openai.model) {
    console.log(`LLM: openai baseUrl=${config.openai.baseUrl} model=${config.openai.model}`);
    return new OpenAiClient(config);
  }
  console.log(`LLM: passthrough mode=${config.mode}`);
  return new PassThroughClient();
}
