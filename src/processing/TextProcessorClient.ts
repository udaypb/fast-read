import type { Frame } from '../reader/types';

type ProcessRequest = {
  requestId: string;
  text: string;
  chunkSize: number;
};

type ProcessResponse = {
  requestId: string;
  frames: Frame[];
  wordCount: number;
};

export class TextProcessorClient {
  private worker: Worker;
  private pending = new Map<string, {
    resolve: (value: ProcessResponse) => void;
    reject: (reason?: unknown) => void;
  }>();

  constructor() {
    this.worker = new Worker(new URL('./textProcessor.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<ProcessResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.requestId);
      if (!pending) return;
      this.pending.delete(response.requestId);
      pending.resolve(response);
    };
    this.worker.onerror = (event) => {
      this.rejectAll(event.message || 'Text processing failed.');
    };
    this.worker.onmessageerror = () => {
      this.rejectAll('Text processing failed.');
    };
  }

  async process(text: string, chunkSize: number): Promise<{ frames: Frame[]; wordCount: number }> {
    const requestId = crypto.randomUUID();
    const payload: ProcessRequest = { requestId, text, chunkSize };
    const result = await new Promise<ProcessResponse>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage(payload);
    });
    return { frames: result.frames, wordCount: result.wordCount };
  }

  private rejectAll(reason: unknown): void {
    const pending = [...this.pending.values()];
    this.pending.clear();
    pending.forEach(({ reject }) => reject(reason instanceof Error ? reason : new Error(String(reason))));
  }
}
