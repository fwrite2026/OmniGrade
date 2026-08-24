/**
 * IndexedDB-backed high-capacity storage for large images & PDF backgrounds.
 * Bypasses localStorage 5MB QuotaExceededError and prevents crashes when loading templates in Studio.
 */

const DB_NAME = 'OMR_IMAGE_STORE';
const DB_VERSION = 1;
const STORE_NAME = 'template_images';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a large image dataUrl or Blob to IndexedDB by key (e.g. template ID or random hash)
 */
export async function saveTemplateImage(id: string, dataUrl: string): Promise<string> {
  if (!id || !dataUrl) return dataUrl;
  
  // In-memory cache for ultra-fast synchronous lookup
  memoryCache.set(id, dataUrl);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(dataUrl, id);
      tx.oncomplete = () => resolve(id);
      tx.onerror = () => {
        console.warn('Could not store image in IndexedDB, using in-memory only', tx.error);
        resolve(id);
      };
    });
  } catch (err) {
    console.warn('IndexedDB unavailable:', err);
    return id;
  }
}

/**
 * In-memory fallback / quick cache
 */
const memoryCache = new Map<string, string>();

/**
 * Loads image dataUrl from IndexedDB or memory cache.
 * If the input is already a dataUrl or standard http URL, returns it immediately.
 */
export async function loadTemplateImage(idOrDataUrl?: string | null): Promise<string | null> {
  if (!idOrDataUrl) return null;

  // If it's already a full data: URL or http(s) URL, return it
  if (idOrDataUrl.startsWith('data:') || idOrDataUrl.startsWith('http://') || idOrDataUrl.startsWith('https://') || idOrDataUrl.startsWith('blob:')) {
    return idOrDataUrl;
  }

  // Check memory cache
  if (memoryCache.has(idOrDataUrl)) {
    return memoryCache.get(idOrDataUrl)!;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
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
    });
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
    return null;
  }
}

/**
 * Removes an image from IndexedDB
 */
export async function deleteTemplateImage(id: string): Promise<void> {
  memoryCache.delete(id);
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}
