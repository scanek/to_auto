/**
 * Offline Storage & Synchronization Engine for Бортовой Журнал
 * Provides robust IndexedDB caching (with localStorage fallback) and
 * background queue synchronization for true Offline-First mobile PWA support.
 */

export interface QueuedAction {
  id: string;
  timestamp: number;
  description: string;
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  entityType?: 'vehicle' | 'service' | 'fuel' | 'reminder' | 'tyre' | 'document';
}

const DB_NAME = 'bortovoi_zhurnal_db';
const DB_VERSION = 1;
const STORE_CACHE = 'offline_cache';
const STORE_QUEUE = 'sync_queue';

class OfflineStorageEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isOnlineStatus: boolean = navigator.onLine;
  private listeners: Set<(isOnline: boolean, pendingCount: number) => void> = new Set();

  constructor() {
    this.initNetworkListeners();
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnlineStatus = true;
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnlineStatus = false;
      this.notifyListeners();
    });
  }

  public subscribe(listener: (isOnline: boolean, pendingCount: number) => void): () => void {
    this.listeners.add(listener);
    this.getPendingQueueCount().then((count) => listener(this.isOnlineStatus, count));
    return () => this.listeners.delete(listener);
  }

  public async notifyListeners() {
    const count = await this.getPendingQueueCount();
    this.listeners.forEach((fn) => fn(this.isOnlineStatus, count));
  }

  public isOnline(): boolean {
    return this.isOnlineStatus;
  }

  public setOnline(status: boolean) {
    if (this.isOnlineStatus !== status) {
      this.isOnlineStatus = status;
      this.notifyListeners();
    }
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });

    return this.dbPromise;
  }

  // -----------------------------------------------------------------
  // 1. Cache Storage (GET responses)
  // -----------------------------------------------------------------
  public async setCache<T>(key: string, data: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CACHE, 'readwrite');
        const store = tx.objectStore(STORE_CACHE);
        store.put({ key, data, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify(data));
      } catch (err) {
        console.warn('Fallback cache write failed', err);
      }
    }
  }

  public async getCache<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise<T | null>((resolve) => {
        const tx = db.transaction(STORE_CACHE, 'readonly');
        const store = tx.objectStore(STORE_CACHE);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.data !== undefined) {
            resolve(req.result.data as T);
          } else {
            resolve(this.getFallbackCache<T>(key));
          }
        };
        req.onerror = () => resolve(this.getFallbackCache<T>(key));
      });
    } catch {
      return this.getFallbackCache<T>(key);
    }
  }

  private getFallbackCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`cache_${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------------
  // 2. Offline Sync Queue (Pending mutations: POST, PUT, DELETE)
  // -----------------------------------------------------------------
  public async enqueueAction(action: Omit<QueuedAction, 'id' | 'timestamp'>): Promise<QueuedAction> {
    const item: QueuedAction = {
      ...action,
      id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const queue = this.getFallbackQueue();
      queue.push(item);
      localStorage.setItem('sync_queue', JSON.stringify(queue));
    }

    this.notifyListeners();
    return item;
  }

  public async getSyncQueue(): Promise<QueuedAction[]> {
    try {
      const db = await this.getDB();
      return new Promise<QueuedAction[]>((resolve) => {
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          res.sort((a: QueuedAction, b: QueuedAction) => a.timestamp - b.timestamp);
          resolve(res);
        };
        req.onerror = () => resolve(this.getFallbackQueue());
      });
    } catch {
      return this.getFallbackQueue();
    }
  }

  public async removeAction(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const queue = this.getFallbackQueue().filter((it) => it.id !== id);
      localStorage.setItem('sync_queue', JSON.stringify(queue));
    }

    this.notifyListeners();
  }

  public async getPendingQueueCount(): Promise<number> {
    const queue = await this.getSyncQueue();
    return queue.length;
  }

  private getFallbackQueue(): QueuedAction[] {
    try {
      const raw = localStorage.getItem('sync_queue');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // -----------------------------------------------------------------
  // 3. Process & Drain Sync Queue (When connection is restored)
  // -----------------------------------------------------------------
  public async processSyncQueue(
    executor: (action: QueuedAction) => Promise<boolean>
  ): Promise<{ processed: number; failed: number }> {
    const queue = await this.getSyncQueue();
    if (queue.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;

    for (const item of queue) {
      try {
        const ok = await executor(item);
        if (ok) {
          await this.removeAction(item.id);
          processed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error('Failed to sync item', item, e);
        failed++;
      }
    }

    this.notifyListeners();
    return { processed, failed };
  }
}

export const offlineStorage = new OfflineStorageEngine();
