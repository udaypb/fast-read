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
  private pending = new Map<string, (value: ProcessResponse) => void>();

  constructor() {
    this.worker = new Worker(new URL('./textProcessor.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<ProcessResponse>) => {
      const response = event.data;
      const resolver = this.pending.get(response.requestId);
      if (!resolver) return;
      this.pending.delete(response.requestId);
      resolver(response);
    };
  }

  async process(text: string, chunkSize: number): Promise<{ frames: Frame[]; wordCount: number }> {
    const requestId = crypto.randomUUID();
    const payload: ProcessRequest = { requestId, text, chunkSize };
    const result = await new Promise<ProcessResponse>((resolve) => {
      this.pending.set(requestId, resolve);
      this.worker.postMessage(payload);
    });
    return { frames: result.frames, wordCount: result.wordCount };
  }
}
