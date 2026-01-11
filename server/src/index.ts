import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

import type { DocRecord, DocStatus, ReelPage } from './types';
import { createLlmClient } from './llm/factory';
import { buildReels } from './services/reels';
import { extractTextFromPdf, normalizeText } from './services/text';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const docs = new Map<string, DocRecord>();
const llmClient = createLlmClient();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/docs', upload.single('file'), async (req, res) => {
  try {
    let text = '';

    if (req.file) {
      text = await extractTextFromPdf(req.file.buffer);
    } else if (typeof req.body?.text === 'string') {
      text = req.body.text;
    }

    text = normalizeText(text);

    if (!text) {
      res.status(400).json({ error: 'Provide a PDF file or text content.' });
      return;
    }

    const docId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const version = 1;

    const reels = await buildReels({
      docId,
      text,
      llm: llmClient,
      createdAt,
      version
    });

    const record: DocRecord = {
      docId,
      text,
      reels,
      createdAt,
      version
    };

    docs.set(docId, record);

    res.json({ docId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process document.' });
  }
});

app.get('/api/docs/:docId/status', (req, res) => {
  const record = docs.get(req.params.docId);

  if (!record) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const status: DocStatus = {
    state: 'ready',
    totalReels: record.reels.length,
    processedReels: record.reels.length
  };

  res.json(status);
});

app.get('/api/docs/:docId/reels', (req, res) => {
  const record = docs.get(req.params.docId);

  if (!record) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const offset = Number(req.query.offset ?? 0);
  const limit = Number(req.query.limit ?? 5);
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 5) : 5;

  const reels = record.reels.slice(safeOffset, safeOffset + safeLimit);
  const prevOffset = safeOffset - safeLimit >= 0 ? safeOffset - safeLimit : null;
  const nextOffset = safeOffset + safeLimit < record.reels.length ? safeOffset + safeLimit : null;

  const payload: ReelPage = {
    docId: record.docId,
    totalReels: record.reels.length,
    offset: safeOffset,
    limit: safeLimit,
    reels,
    prevOffset,
    nextOffset
  };

  res.json(payload);
});

const port = Number(process.env.PORT ?? 5174);
app.listen(port, () => {
  console.log(`Fast Read server running on http://localhost:${port}`);
});
