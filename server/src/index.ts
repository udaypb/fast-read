import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

import type { DocRecord, DocStatus, ReelPage, Reel } from './types.js';
import { loadLocalEnv } from './env.js';
import { buildReels, createDocRecord } from './services/reels.js';
import { extractTextFromPdf, normalizeText } from './services/text.js';

loadLocalEnv();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const docs = new Map<string, DocRecord>();
const eventBus = new EventEmitter();

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

    // Create initial record
    const record = createDocRecord({
      docId,
      text,
      reels: [],
      createdAt,
      version,
      state: 'processing'
    });
    docs.set(docId, record);

    // Start background processing
    void buildReels({
      docId,
      text,
      createdAt,
      version,
      onReel: (reel) => {
        const doc = docs.get(docId);
        if (doc) {
          doc.reels.push(reel);
        }
        eventBus.emit(`reel:${docId}`, reel);
      }
    }).then((reels) => {
      const doc = docs.get(docId);
      if (doc) {
        doc.state = 'ready';
        doc.reels = reels;
      }
      console.log(`Finished processing doc ${docId}, total reels: ${reels.length}`);
      eventBus.emit(`done:${docId}`);
    }).catch((error) => {
      console.error(`Failed processing doc ${docId}`, error);
      const doc = docs.get(docId);
      if (doc) {
        doc.state = 'error';
        doc.error = 'Failed to build reels.';
      }
      eventBus.emit(`done:${docId}`);
    });

    res.json({ docId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process document.' });
  }
});

app.get('/api/docs/:docId/stream', (req, res) => {
  const { docId } = req.params;
  const doc = docs.get(docId);

  if (!doc) {
    res.status(404).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send existing reels first
  for (const reel of doc.reels) {
    res.write(`data: ${JSON.stringify(reel)}\n\n`);
  }

  if (doc.state === 'ready' || doc.state === 'error') {
    res.write('event: done\ndata: {}\n\n');
    res.end();
    return;
  }

  const onReel = (reel: Reel) => {
    res.write(`data: ${JSON.stringify(reel)}\n\n`);
  };

  const onDone = () => {
    res.write('event: done\ndata: {}\n\n');
    res.end();
  };

  eventBus.on(`reel:${docId}`, onReel);
  eventBus.once(`done:${docId}`, onDone);

  req.on('close', () => {
    eventBus.off(`reel:${docId}`, onReel);
    eventBus.off(`done:${docId}`, onDone);
  });
});

app.get('/api/docs/:docId/status', (req, res) => {
  const record = docs.get(req.params.docId);

  if (!record) {
    res.status(404).json({ error: 'Document not found.' });
    return;
  }

  const status: DocStatus = {
    state: record.state,
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
