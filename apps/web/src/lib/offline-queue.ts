/**
 * Offline answer queue (spec §8): the patient's pending answer is kept in IndexedDB and sent when the
 * connection returns — also after a reload. One pending answer per interview (it is turn-based).
 * Stored only on the patient's own device, and deleted as soon as it is sent.
 */
export interface PendingAnswer {
  sessionId: string;
  text: string;
  voiceId?: string;
  at: number;
}

const DB = 'medicos';
const STORE = 'pending-answers';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'sessionId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined; // private mode / storage blocked: the app still works online
  }
}

export const savePending = (p: PendingAnswer) => tx('readwrite', (s) => s.put(p));
export const getPending = (sessionId: string) => tx<PendingAnswer>('readonly', (s) => s.get(sessionId) as IDBRequest<PendingAnswer>);
export const clearPending = (sessionId: string) => tx('readwrite', (s) => s.delete(sessionId));
