import type { AnalyzeRequest, AnalyzeResult, CondenseRequest, CondenseResult, LlmClient } from './types.js';

export class PassThroughClient implements LlmClient {
  async condense(request: CondenseRequest): Promise<CondenseResult> {
    const text = request.text;
    const script = buildFallbackScript(text);
    return { text, script };
  }

  async analyze(_request: AnalyzeRequest): Promise<AnalyzeResult> {
    return { sentiment: 'neutral', tags: [] };
  }
}

function buildFallbackScript(text: string): { characterId: string; text: string }[] {
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const lines = sentences.length > 0 ? sentences : [text.trim()].filter(Boolean);

  return lines.map((line, index) => ({
    characterId: index % 2 === 0 ? 'character1' : 'character2',
    text: line
  }));
}
