import * as pdfjsLib from 'pdfjs-dist';

// Set up pdf.js worker
// Use unpkg or cdnjs with fallback or standard worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface PdfPageResult {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Converts a PDF file into high-resolution image data URLs (one per page).
 * Ideal for OMR recognition template creation and exam sheet batch grading.
 */
export async function convertPdfToImages(
  file: File | Blob | ArrayBuffer,
  scale: number = 2.0
): Promise<PdfPageResult[]> {
  try {
    let arrayBuffer: ArrayBuffer;
    if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    } else if (file instanceof Blob) {
      arrayBuffer = await file.arrayBuffer();
    } else {
      throw new Error('Unsupported file format for PDF conversion.');
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const results: PdfPageResult[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white background before rendering
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext as any).promise;

      const dataUrl = canvas.toDataURL('image/png', 0.95);
      results.push({
        pageNumber: pageNum,
        dataUrl,
        width: viewport.width,
        height: viewport.height,
      });
    }

    return results;
  } catch (error) {
    console.error('Error rendering PDF with pdfjs-dist:', error);
    throw error;
  }
}

/**
 * Reads any uploaded file (PDF, PNG, JPG) and returns an array of image data URLs.
 */
export async function processUploadedFileToImages(
  file: File
): Promise<{ pages: PdfPageResult[]; isPdf: boolean }> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const pages = await convertPdfToImages(file, 2.0);
    return { pages, isPdf: true };
  }

  // Image file
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          pages: [
            {
              pageNumber: 1,
              dataUrl,
              width: img.width,
              height: img.height,
            },
          ],
          isPdf: false,
        });
      };
      img.onerror = () => {
        resolve({
          pages: [
            {
              pageNumber: 1,
              dataUrl,
              width: 1200,
              height: 1697,
            },
          ],
          isPdf: false,
        });
      };
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
