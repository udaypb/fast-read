import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractTextFromPdf(file: File): Promise<string> {
  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent();
        const pageText = (textContent.items as Array<{ str?: string }>)
          .map((item) => item.str ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (pageText) pages.push(pageText);
      } finally {
        page.cleanup();
      }

      if (pageNumber % 5 === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
    }

    return pages.join('\n\n');
  } catch (error) {
    throw getPdfError(error);
  } finally {
    if (loadingTask) {
      await loadingTask.destroy().catch(() => undefined);
    }
  }
}

function getPdfError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : '';

  if (/password/i.test(`${name} ${message}`)) {
    return new Error('This PDF is password protected. Remove the password and upload it again.');
  }

  return new Error('Could not read this PDF. Please upload a text-based PDF up to 10 MB.');
}
