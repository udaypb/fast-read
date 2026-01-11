import type { AnalyzeRequest, AnalyzeResult, CondenseRequest, CondenseResult, LlmClient } from './types';

export class PassThroughClient implements LlmClient {
  async condense(request: CondenseRequest): Promise<CondenseResult> {
    return { text: request.text };
  }

  async analyze(_request: AnalyzeRequest): Promise<AnalyzeResult> {
    return { sentiment: 'neutral', tags: [] };
  }
}
