/**
 * IndexedDB-backed high-capacity storage for large images & PDF backgrounds.
 * Bypasses localStorage 5MB QuotaExceededError and prevents crashes when loading templates and grading exam sheets.
 */

const DB_NAME = 'OMR_IMAGE_STORE';
const DB_VERSION = 2;
const TEMPLATE_STORE = 'template_images';
const SUBMISSION_STORE = 'submission_images';
const GENERAL_STORE = 'general_images';

// In-memory cache for ultra-fast synchronous lookup across components
const memoryCache = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TEMPLATE_STORE)) {
        db.createObjectStore(TEMPLATE_STORE);
      }
      if (!db.objectStoreNames.contains(SUBMISSION_STORE)) {
        db.createObjectStore(SUBMISSION_STORE);
      }
      if (!db.objectStoreNames.contains(GENERAL_STORE)) {
        db.createObjectStore(GENERAL_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Universal helper to store an image in IndexedDB with in-memory caching
 */
async function storeInDB(storeName: string, id: string, dataUrl: string): Promise<string> {
  if (!id || !dataUrl) return dataUrl;

  // Always update in-memory cache first for instant synchronous reads
  memoryCache.set(id, dataUrl);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(dataUrl, id);
        tx.oncomplete = () => resolve(id);
        tx.onerror = () => {
          console.warn(`Could not store image in ${storeName}, using memory cache`, tx.error);
          resolve(id);
        };
      } catch (err) {
        console.warn(`Transaction error in ${storeName}:`, err);
        resolve(id);
      }
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, operating in memory-only mode:', err);
    return id;
  }
}

/**
 * Universal helper to load an image from memory cache or IndexedDB
 */
async function readFromDB(storeName: string, idOrDataUrl?: string | null): Promise<string | null> {
  if (!idOrDataUrl) return null;

  // If it's already a full data: URL, blob URL or http(s) URL, return it immediately
  if (
    idOrDataUrl.startsWith('data:') ||
    idOrDataUrl.startsWith('http://') ||
    idOrDataUrl.startsWith('https://') ||
    idOrDataUrl.startsWith('blob:')
  ) {
    return idOrDataUrl;
  }

  // Check in-memory cache
  if (memoryCache.has(idOrDataUrl)) {
    return memoryCache.get(idOrDataUrl)!;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(idOrDataUrl);
        req.onsuccess = () => {
          const val = req.result as string | undefined;
          if (val) {
            memoryCache.set(idOrDataUrl, val);
            resolve(val);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn(`Error reading from IndexedDB store ${storeName}:`, err);
    return null;
  }
}

/**
 * Universal helper to remove an image from memory cache & IndexedDB
 */
async function deleteFromDB(storeName: string, id: string): Promise<void> {
  memoryCache.delete(id);
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore error
  }
}

// ----------------- TEMPLATE IMAGES -----------------
export async function saveTemplateImage(id: string, dataUrl: string): Promise<string> {
  return storeInDB(TEMPLATE_STORE, id, dataUrl);
}

export async function loadTemplateImage(idOrDataUrl?: string | null): Promise<string | null> {
  return readFromDB(TEMPLATE_STORE, idOrDataUrl);
}

export async function deleteTemplateImage(id: string): Promise<void> {
  return deleteFromDB(TEMPLATE_STORE, id);
}

// ----------------- SUBMISSION / EXAM SCAN IMAGES -----------------
export async function saveSubmissionImage(id: string, dataUrl: string): Promise<string> {
  return storeInDB(SUBMISSION_STORE, id, dataUrl);
}

export async function loadSubmissionImage(idOrDataUrl?: string | null): Promise<string | null> {
  // Try submission store first, fallback to general store if needed
  const subImg = await readFromDB(SUBMISSION_STORE, idOrDataUrl);
  if (subImg) return subImg;
  return readFromDB(GENERAL_STORE, idOrDataUrl);
}

export async function deleteSubmissionImage(id: string): Promise<void> {
  return deleteFromDB(SUBMISSION_STORE, id);
}

// ----------------- GENERAL IMAGES -----------------
export async function saveImage(id: string, dataUrl: string): Promise<string> {
  return storeInDB(GENERAL_STORE, id, dataUrl);
}

export async function loadImage(idOrDataUrl?: string | null): Promise<string | null> {
  return readFromDB(GENERAL_STORE, idOrDataUrl);
}

export async function deleteImage(id: string): Promise<void> {
  return deleteFromDB(GENERAL_STORE, id);
}

/**
 * Optimizes and downsizes an image (e.g. from camera 4K or 10MB photo) to standard resolution
 * suitable for high-precision OMR without consuming extreme memory or blowing storage quotas.
 */
export async function optimizeImageForOMR(dataUrl: string, maxDim = 1600, quality = 0.88): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }

  // If already compact (< 250KB), no need to re-encode
  if (dataUrl.length < 350000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (e) {
        console.warn('Image optimization fallback:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Resilient localStorage.setItem wrapper that safely handles QuotaExceededError
 * and prevents uncaught storage exceptions from crashing the application.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error: any) {
    console.warn(`LocalStorage quota reached when setting "${key}". Triggering emergency cleanup:`, error);
    
    try {
      // 1. Try cleaning up legacy heavy keys or temporary cache
      const keysToPurge = ['omr_cache', 'omr_temp_images', 'omr_draft_image', 'omr_debug_logs'];
      keysToPurge.forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });

      // 2. Retry setItem
      localStorage.setItem(key, value);
      return true;
    } catch (secondError) {
      console.warn(`LocalStorage setItem still failed for "${key}" after purge. Data preserved in memory/IndexedDB.`, secondError);
      return false;
    }
  }
}

/**
 * Resilient localStorage.getItem with JSON parse fallback
 */
export function safeLocalStorageGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    return JSON.parse(item) as T;
  } catch (e) {
    console.warn(`Error reading/parsing key "${key}" from localStorage:`, e);
    return fallback;
  }
}

