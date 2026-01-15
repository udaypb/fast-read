import type { AnalyzeRequest, AnalyzeResult, CondenseRequest, CondenseResult, LlmClient } from './types.js';
import type { LlmConfig } from './config.js';

const DEFAULT_TEMPERATURE = 0.2;
const ANALYZE_MAX_TOKENS = 120;

export class OpenAiClient implements LlmClient {
  private baseUrl: string;
  private model: string;
  private headers: Record<string, string>;
  private timeoutMs: number;
  private prompts?: LlmConfig['prompts'];

  constructor(config: LlmConfig) {
    if (!config.openai?.baseUrl || !config.openai.model) {
      throw new Error('OpenAI config missing baseUrl or model.');
    }

    this.baseUrl = normalizeBaseUrl(config.openai.baseUrl);
    this.model = config.openai.model;
    const configuredTimeout = Number(config.openai.timeoutMs);
    this.timeoutMs = Number.isFinite(configuredTimeout) ? configuredTimeout : 45000;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.openai.headers
    };

    if (config.openai.apiKey) {
      this.headers.Authorization = `Bearer ${config.openai.apiKey}`;
    }

    this.prompts = config.prompts;
  }

  async condense(request: CondenseRequest): Promise<CondenseResult> {
    const prompt = this.prompts?.condense ??
      'You condense text for speed reading reels. Return JSON with a "text" field.';
    const payload = {
      model: this.model,
      temperature: DEFAULT_TEMPERATURE,
      stream: false,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: buildCondenseUserPrompt(request) }
      ]
    };

    console.log('[Condense] Prompt:', prompt);
    const response = await this.request(payload);
    console.log('[Condense] Response keys:', Object.keys(response));

    const json = extractJsonString(response);

    // Valid JSON? Use it.
    if (json && typeof json.text === 'string') {
      console.log('[Condense] Using JSON extracted content');
      return {
        text: json.text,
        title: typeof json.title === 'string' ? json.title : undefined
      };
    }

    // No valid JSON? Use raw content if available.
    const raw = getResponseContent(response);
    if (typeof raw === 'string') {
      console.log('[Condense] Using raw content');
      return { text: raw };
    }

    // Fallback to original text if everything failed
    console.warn('[Condense] Falling back to original text.');
    return { text: request.text };
  }

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResult> {
    const prompt = this.prompts?.analyze ??
      'Analyze the text sentiment and return JSON with "sentiment" ("positive", "neutral", or "negative"), "tags", "backgroundId", "backgroundName", and "reason". Tags must be chosen from the provided background keywords.';
    const systemPrompt = buildAnalyzeSystemPrompt(prompt, request.backgroundSummary);
    const payload = {
      model: this.model,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: ANALYZE_MAX_TOKENS,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildAnalyzeUserPrompt(request) }
      ]
    };

    const response = await this.request(payload);
    const parsed = extractJsonString(response) ?? extractLooseAnalysis(response);
    const sentiment = extractSentiment(parsed?.sentiment);
    const tags = extractTags(parsed?.tags);
    const backgroundId = extractBackgroundId(parsed);
    const backgroundName = extractBackgroundName(parsed);
    const reason = extractReason(parsed);
    return {
      sentiment,
      tags,
      backgroundId,
      backgroundName,
      reason,
      data: parsed ?? response
    };
  }

  private async request(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const timeoutMs = this.timeoutMs;
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: controller?.signal
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `LLM request failed with ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      console.log('LLM response:', data);
      // Safe access using any cast for unknown structure
      const content = (data as any)?.choices?.[0]?.message?.content;
      if (typeof content === 'string') {
        console.log('LLM message content:', content);
      }
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      if (id) clearTimeout(id);
    }
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildCondenseUserPrompt(request: CondenseRequest): string {
  const target = request.targetWords ? `Target words: ${request.targetWords}.` : '';
  return `Condense the following text. ${target}\n\n${request.text}`.trim();
}

function buildAnalyzeUserPrompt(request: AnalyzeRequest): string {
  return `Text:\n${request.text}`.trim();
}

function buildAnalyzeSystemPrompt(prompt: string, backgroundSummary?: string): string {
  if (!backgroundSummary) return prompt;

  return [
    prompt.trim(),
    'Available backgrounds with keywords (choose tags from these keywords only):',
    backgroundSummary,
    'Return JSON only with keys: sentiment, tags, backgroundId, backgroundName, reason.',
    'backgroundId must be one of the valid ids above (use the id before the parentheses).',
    'Do not return numeric indexes.',
    'Reason must be one sentence and no more than 18 words.'
  ].join('\n');
}

function extractJsonString(response: Record<string, unknown>): Record<string, unknown> | null {
  const content = getResponseContent(response);
  if (!content) return null;

  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function extractLooseAnalysis(response: Record<string, unknown>): Record<string, unknown> | null {
  const content = getResponseContent(response);
  if (!content) return null;

  const result: Record<string, unknown> = {};
  const tagsMatch = content.match(/tags?\s*[:=-]\s*([^\n]+)/i);
  if (tagsMatch?.[1]) {
    const rawTags = tagsMatch[1]
      .split(/[,\|;]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (rawTags.length > 0) {
      result.tags = rawTags;
    }
  }

  const sentimentMatch = content.match(/sentiment\s*[:=-]\s*([^\n]+)/i);
  if (sentimentMatch?.[1]) {
    result.sentiment = sentimentMatch[1].trim();
  }

  const backgroundIdMatch = content.match(/background\s*id\s*[:=-]\s*([^\n]+)/i);
  if (backgroundIdMatch?.[1]) {
    result.backgroundId = backgroundIdMatch[1].trim();
  } else {
    const backgroundMatch = content.match(/background\s*[:=-]\s*([^\n]+)/i);
    if (backgroundMatch?.[1]) {
      result.backgroundId = backgroundMatch[1].trim();
    }
  }

  const backgroundNameMatch = content.match(/background\s*name\s*[:=-]\s*([^\n]+)/i);
  if (backgroundNameMatch?.[1]) {
    result.backgroundName = backgroundNameMatch[1].trim();
  }

  const reasonMatch = content.match(/reason\s*[:=-]\s*([^\n]+)/i);
  if (reasonMatch?.[1]) {
    result.reason = reasonMatch[1].trim();
  }

  return Object.keys(result).length > 0 ? result : null;
}

function getResponseContent(response: Record<string, unknown>): string | null {
  const choices = (response as any).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;
  return content.trim();
}

function extractBackgroundId(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;

  const direct = parsed.backgroundId;
  if (typeof direct === 'string') return normalizeBackgroundId(direct);

  const named = parsed.backgroundName;
  if (typeof named === 'string') return normalizeBackgroundId(named);

  const label = parsed.backgroundLabel;
  if (typeof label === 'string') return normalizeBackgroundId(label);

  const background = parsed.background;
  if (typeof background === 'string') return normalizeBackgroundId(background);
  if (background && typeof background === 'object') {
    const obj = background as { id?: unknown; name?: unknown; label?: unknown; module?: unknown };
    const id = typeof obj.id === 'string' ? obj.id :
      typeof obj.name === 'string' ? obj.name :
        typeof obj.label === 'string' ? obj.label :
          typeof obj.module === 'string' ? obj.module :
            undefined;
    if (id) return normalizeBackgroundId(id);
  }

  const theme = parsed.theme;
  if (typeof theme === 'string') return normalizeBackgroundId(theme);

  return undefined;
}

function extractBackgroundName(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;

  const direct = parsed.backgroundName;
  if (typeof direct === 'string') return direct.trim();

  const label = parsed.backgroundLabel;
  if (typeof label === 'string') return label.trim();

  const background = parsed.background;
  if (background && typeof background === 'object') {
    const obj = background as { label?: unknown; name?: unknown };
    if (typeof obj.label === 'string') return obj.label.trim();
    if (typeof obj.name === 'string') return obj.name.trim();
  }

  return undefined;
}

function normalizeBackgroundId(value: string): string {
  const trimmed = value.trim();
  const withoutIndex = trimmed.replace(/^\d+\s*[\).:-]?\s*/g, '');
  const parenMatch = withoutIndex.match(/\(([^)]+)\)/);
  const candidate = parenMatch ? parenMatch[1] : withoutIndex;
  const lastSegment = candidate.split('/').pop() ?? candidate;
  const afterDot = lastSegment.includes('.') ? lastSegment.split('.').pop() ?? lastSegment : lastSegment;
  return afterDot.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractSentiment(value: unknown): string | undefined {
  if (typeof value === 'string') return normalizeSentiment(value);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const category = obj.category;
    if (typeof category === 'string') return normalizeSentiment(category);
    const score = obj.score;
    if (typeof score === 'number') {
      return score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
    }

    const positive = obj.positive;
    const negative = obj.negative;
    const neutral = obj.neutral;
    if (typeof positive === 'number' || typeof negative === 'number' || typeof neutral === 'number') {
      const pos = typeof positive === 'number' ? positive : 0;
      const neg = typeof negative === 'number' ? negative : 0;
      const neu = typeof neutral === 'number' ? neutral : 0;
      return sentimentFromScores(pos, neg, neu);
    }
  }
  return undefined;
}

function extractReason(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;
  const reason = parsed.reason;
  if (typeof reason === 'string') return reason.trim();
  const explanation = parsed.explanation;
  if (typeof explanation === 'string') return explanation.trim();
  const rationale = parsed.rationale;
  if (typeof rationale === 'string') return rationale.trim();
  return undefined;
}

function sentimentFromScores(positive: number, negative: number, neutral: number): string {
  const max = Math.max(positive, negative, neutral);
  if (max === neutral) return 'neutral';
  if (max === positive) {
    return positive - negative >= 0.1 ? 'positive' : 'neutral';
  }
  return negative - positive >= 0.1 ? 'negative' : 'neutral';
}

function normalizeSentiment(value: string): string | undefined {
  const lower = value.trim().toLowerCase();
  if (lower.includes('positive')) return 'positive';
  if (lower.includes('negative')) return 'negative';
  if (lower.includes('neutral')) return 'neutral';
  return undefined;
}

function extractTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return undefined;
}
