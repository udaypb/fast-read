export type CondenseRequest = {
  text: string;
  targetWords?: number;
};

export type CondenseResult = {
  text: string;
  title?: string;
};

export type AnalyzeRequest = {
  text: string;
  backgroundSummary?: string;
};

export type AnalyzeResult = {
  sentiment?: string;
  tags?: string[];
  backgroundId?: string;
  backgroundName?: string;
  reason?: string;
  data?: Record<string, unknown>;
};

export interface LlmClient {
  condense(request: CondenseRequest): Promise<CondenseResult>;
  analyze(request: AnalyzeRequest): Promise<AnalyzeResult>;
}
