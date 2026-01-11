import type { DocCreateResponse, DocStatus, ReelPage, Reel } from './types';

const DEFAULT_API_BASE = 'http://localhost:5174';

function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return configured ?? DEFAULT_API_BASE;
}

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function createDocFromText(text: string): Promise<DocCreateResponse> {
  const response = await fetch(`${apiBase()}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  return handleJson<DocCreateResponse>(response);
}

export async function createDocFromFile(file: File): Promise<DocCreateResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${apiBase()}/api/docs`, {
    method: 'POST',
    body: formData
  });

  return handleJson<DocCreateResponse>(response);
}

export async function getDocStatus(docId: string): Promise<DocStatus> {
  const response = await fetch(`${apiBase()}/api/docs/${docId}/status`);
  return handleJson<DocStatus>(response);
}

export async function getReelPage(docId: string, offset: number, limit: number): Promise<ReelPage> {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit)
  });
  const response = await fetch(`${apiBase()}/api/docs/${docId}/reels?${params.toString()}`);
  return handleJson<ReelPage>(response);
}

export function streamReels(docId: string, onReel: (reel: Reel) => void): () => void {
  const url = `${apiBase()}/api/docs/${docId}/stream`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.reelId) {
        onReel(data as Reel);
      }
    } catch (error) {
      console.warn('Failed to parse SSE message:', error);
    }
  };

  eventSource.addEventListener('done', () => {
    eventSource.close();
  });

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
