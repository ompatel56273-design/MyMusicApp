import { DatabaseError } from '../../core/errors/app-error';
import { Logger } from '../../core/logging/logger';
import { DB_NAME, CURRENT_SCHEMA_VERSION, MIGRATIONS, type StoreName } from './schema';

export interface IDatabaseAdapter {
  open(): Promise<void>;
  close(): void;
  isOpen(): boolean;
  get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null>;
  getAll<T>(storeName: StoreName, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]>;
  getByIndex<T>(storeName: StoreName, indexName: string, key: IDBValidKey | IDBKeyRange): Promise<T | null>;
  getAllByIndex<T>(storeName: StoreName, indexName: string, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]>;
  put<T>(storeName: StoreName, value: T): Promise<void>;
  putBatch<T>(storeName: StoreName, values: readonly T[]): Promise<void>;
  delete(storeName: StoreName, key: IDBValidKey): Promise<void>;
  clear(storeName: StoreName): Promise<void>;
  count(storeName: StoreName, query?: IDBValidKey | IDBKeyRange): Promise<number>;
  transaction<T>(storeNames: StoreName[], mode: IDBTransactionMode, callback: (tx: IDBTransaction) => Promise<T>): Promise<T>;
}

/**
 * Concrete IndexedDB Database Adapter.
 * Encapsulates connection lifecycle, transaction safety, and schema upgrades.
 */
export class IndexedDbAdapter implements IDatabaseAdapter {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly version: number;
  private readonly logger = new Logger('DatabaseAdapter');
  private readonly idbFactory: IDBFactory;

  constructor(dbName: string = DB_NAME, version: number = CURRENT_SCHEMA_VERSION, customFactory?: IDBFactory) {
    this.dbName = dbName;
    this.version = version;
    this.idbFactory = customFactory || (typeof indexedDB !== 'undefined' ? indexedDB : (globalThis as any).indexedDB);
  }

  public isOpen(): boolean {
    return this.db !== null;
  }

  public async open(): Promise<void> {
    if (this.db) {
      return;
    }

    if (!this.idbFactory) {
      throw new DatabaseError(
        'IndexedDB factory is not available in the current environment.',
        'ERR_IDB_UNAVAILABLE'
      );
    }

    return new Promise((resolve, reject) => {
      try {
        const request = this.idbFactory.open(this.dbName, this.version);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = request.result;
          const tx = request.transaction!;
          const oldVersion = event.oldVersion;
          this.logger.info(`Upgrading database from schema version ${oldVersion} to ${this.version}...`);

          for (const migration of MIGRATIONS) {
            if (migration.version > oldVersion && migration.version <= this.version) {
              this.logger.info(`Applying migration v${migration.version}...`);
              migration.up(db, tx);
            }
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.logger.info(`Database "${this.dbName}" (v${this.version}) opened successfully.`);
          resolve();
        };

        request.onerror = () => {
          const err = new DatabaseError(
            `Failed to open database "${this.dbName}": ${request.error?.message ?? 'Unknown error'}`,
            'ERR_DB_OPEN_FAILED',
            undefined,
            request.error ?? undefined
          );
          this.logger.error('Database open error', err);
          reject(err);
        };

        request.onblocked = () => {
          this.logger.warn(`Database "${this.dbName}" open request blocked by another tab.`);
        };
      } catch (e) {
        reject(new DatabaseError('Unexpected error opening database', 'ERR_DB_OPEN_EXCEPTION', undefined, e as Error));
      }
    });
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info(`Database "${this.dbName}" closed.`);
    }
  }

  private ensureOpen(): IDBDatabase {
    if (!this.db) {
      throw new DatabaseError('Database is not open. Call open() first.', 'ERR_DB_NOT_OPEN');
    }
    return this.db;
  }

  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result !== undefined ? (request.result as T) : null);
        request.onerror = () => reject(new DatabaseError(`Failed to get key from ${storeName}`, 'ERR_DB_GET', undefined, request.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async getAll<T>(storeName: StoreName, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll(query, count);

        request.onsuccess = () => resolve((request.result as T[]) || []);
        request.onerror = () => reject(new DatabaseError(`Failed to getAll from ${storeName}`, 'ERR_DB_GET_ALL', undefined, request.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async getByIndex<T>(storeName: StoreName, indexName: string, key: IDBValidKey | IDBKeyRange): Promise<T | null> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.get(key);

        request.onsuccess = () => resolve(request.result !== undefined ? (request.result as T) : null);
        request.onerror = () => reject(new DatabaseError(`Failed to getByIndex from ${storeName}.${indexName}`, 'ERR_DB_GET_BY_INDEX', undefined, request.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}.${indexName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async getAllByIndex<T>(storeName: StoreName, indexName: string, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(query, count);

        request.onsuccess = () => resolve((request.result as T[]) || []);
        request.onerror = () => reject(new DatabaseError(`Failed to getAllByIndex from ${storeName}.${indexName}`, 'ERR_DB_GET_ALL_BY_INDEX', undefined, request.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}.${indexName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async put<T>(storeName: StoreName, value: T): Promise<void> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(value);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new DatabaseError(`Failed to put item into ${storeName}`, 'ERR_DB_PUT', undefined, tx.error ?? undefined));
        tx.onabort = () => reject(new DatabaseError(`Transaction aborted on put to ${storeName}`, 'ERR_DB_TX_ABORT'));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async putBatch<T>(storeName: StoreName, values: readonly T[]): Promise<void> {
    if (values.length === 0) return;
    const db = this.ensureOpen();

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        for (const val of values) {
          store.put(val);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new DatabaseError(`Failed to batch put into ${storeName}`, 'ERR_DB_PUT_BATCH', undefined, tx.error ?? undefined));
        tx.onabort = () => reject(new DatabaseError(`Transaction aborted on batch put to ${storeName}`, 'ERR_DB_TX_ABORT'));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new DatabaseError(`Failed to delete key from ${storeName}`, 'ERR_DB_DELETE', undefined, tx.error ?? undefined));
        tx.onabort = () => reject(new DatabaseError(`Transaction aborted on delete from ${storeName}`, 'ERR_DB_TX_ABORT'));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new DatabaseError(`Failed to clear ${storeName}`, 'ERR_DB_CLEAR', undefined, tx.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async count(storeName: StoreName, query?: IDBValidKey | IDBKeyRange): Promise<number> {
    const db = this.ensureOpen();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.count(query);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new DatabaseError(`Failed to count ${storeName}`, 'ERR_DB_COUNT', undefined, request.error ?? undefined));
      } catch (err) {
        reject(new DatabaseError(`Transaction error on ${storeName}`, 'ERR_DB_TX', undefined, err as Error));
      }
    });
  }

  public async transaction<T>(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = this.ensureOpen();
    const tx = db.transaction(storeNames, mode);

    try {
      const result = await callback(tx);
      return result;
    } catch (err) {
      tx.abort();
      throw new DatabaseError('Explicit transaction failed and was aborted', 'ERR_DB_TX_FAILED', undefined, err as Error);
    }
  }
}
