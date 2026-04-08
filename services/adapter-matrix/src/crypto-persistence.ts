/**
 * IndexedDB dump/restore for persistent E2EE crypto state.
 *
 * matrix-sdk-crypto-wasm stores OlmMachine state (device keys, Olm sessions,
 * Megolm sessions, cross-signing keys) in IndexedDB. In Node.js we polyfill
 * IndexedDB with `fake-indexeddb` (in-memory). This module serialises the
 * entire IndexedDB contents to a JSON file on shutdown, and restores it
 * on startup so the bot preserves its device identity across restarts.
 */

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createLogger } from '@sven/shared';

const logger = createLogger('crypto-persistence');

const CRYPTO_STORE_DIR = process.env.MATRIX_CRYPTO_STORE_PATH || '/data/crypto';
const DUMP_FILE = `${CRYPTO_STORE_DIR}/indexeddb-state.json`;
const MAX_DUMP_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_RECORDS_PER_STORE = 5_000_000;

/* ── Serialisation types ───────────────────────────────────── */

interface IndexedDBDump {
  version: 1;
  timestamp: string;
  databases: DatabaseDump[];
}

interface DatabaseDump {
  name: string;
  version: number;
  objectStores: ObjectStoreDump[];
}

interface ObjectStoreDump {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IndexDump[];
  records: SerializedRecord[];
}

interface IndexDump {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

interface SerializedRecord {
  key: unknown;
  value: unknown;
}

/* ── Binary-safe JSON helpers ──────────────────────────────── */

function serialise(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { __t: 'u8', d: Buffer.from(value).toString('base64') };
  }
  if (value instanceof ArrayBuffer) {
    return { __t: 'ab', d: Buffer.from(value).toString('base64') };
  }
  if (value instanceof Date) {
    return { __t: 'dt', d: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(serialise);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialise(v);
    }
    return out;
  }
  return value;
}

function deserialise(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.__t === 'u8' && typeof obj.d === 'string') {
      return new Uint8Array(Buffer.from(obj.d as string, 'base64'));
    }
    if (obj.__t === 'ab' && typeof obj.d === 'string') {
      const buf = Buffer.from(obj.d as string, 'base64');
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    if (obj.__t === 'dt' && typeof obj.d === 'string') {
      return new Date(obj.d as string);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserialise(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(deserialise);
  }
  return value;
}

/* ── IndexedDB Dump ────────────────────────────────────────── */

function readObjectStore(db: IDBDatabase, storeName: string): Promise<ObjectStoreDump | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);

      const indexes: IndexDump[] = [];
      for (const indexName of Array.from(store.indexNames)) {
        const idx = store.index(indexName);
        indexes.push({
          name: idx.name,
          keyPath: idx.keyPath as string | string[],
          unique: idx.unique,
          multiEntry: idx.multiEntry,
        });
      }

      const reqValues = store.getAll();
      const reqKeys = store.getAllKeys();
      let values: unknown[] = [];
      let keys: IDBValidKey[] = [];

      reqValues.onsuccess = () => { values = reqValues.result; };
      reqKeys.onsuccess = () => { keys = reqKeys.result; };

      tx.oncomplete = () => {
        resolve({
          name: storeName,
          keyPath: store.keyPath as string | string[] | null,
          autoIncrement: store.autoIncrement,
          indexes,
          records: keys.map((key, i) => ({
            key: serialise(key),
            value: serialise(values[i]),
          })),
        });
      };
      tx.onerror = () => {
        logger.warn('Failed to read object store for dump', { store: storeName });
        resolve(null);
      };
    } catch (err) {
      logger.warn('Error opening object store for dump', { store: storeName, error: String(err) });
      resolve(null);
    }
  });
}

function openAndDumpDB(name: string, version: number): Promise<DatabaseDump | null> {
  return new Promise((resolve) => {
    const req = globalThis.indexedDB.open(name, version);
    req.onerror = () => { resolve(null); };
    req.onsuccess = async () => {
      const db = req.result;
      try {
        const dbDump: DatabaseDump = { name, version: db.version, objectStores: [] };
        for (const storeName of Array.from(db.objectStoreNames)) {
          const storeDump = await readObjectStore(db, storeName);
          if (storeDump) dbDump.objectStores.push(storeDump);
        }
        db.close();
        resolve(dbDump);
      } catch (err) {
        db.close();
        logger.warn('Failed to dump database', { name, error: String(err) });
        resolve(null);
      }
    };
  });
}

export async function dumpIndexedDB(): Promise<void> {
  try {
    const databases = await globalThis.indexedDB.databases();
    if (!databases || databases.length === 0) {
      logger.info('No IndexedDB databases to dump');
      return;
    }

    const dump: IndexedDBDump = { version: 1, timestamp: new Date().toISOString(), databases: [] };

    for (const dbInfo of databases) {
      if (!dbInfo.name) continue;
      const dbDump = await openAndDumpDB(dbInfo.name, dbInfo.version || 1);
      if (dbDump) dump.databases.push(dbDump);
    }

    const totalRecords = dump.databases.reduce(
      (sum, db) => sum + db.objectStores.reduce((s, os) => s + os.records.length, 0), 0,
    );

    await mkdir(dirname(DUMP_FILE), { recursive: true });
    const dumpJson = JSON.stringify(dump);
    if (dumpJson.length > MAX_DUMP_SIZE) {
      logger.error('Crypto store dump exceeds size limit, skipping persist', {
        size: dumpJson.length,
        limit: MAX_DUMP_SIZE,
      });
      return;
    }
    await writeFile(DUMP_FILE, dumpJson, 'utf8');
    logger.info('Crypto store persisted', {
      databases: dump.databases.length,
      total_records: totalRecords,
      path: DUMP_FILE,
    });
  } catch (err) {
    logger.error('Failed to persist crypto store', { error: String(err) });
  }
}

/* ── IndexedDB Restore ─────────────────────────────────────── */

function populateStore(db: IDBDatabase, storeDump: ObjectStoreDump): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeDump.name, 'readwrite');
    const store = tx.objectStore(storeDump.name);

    for (const record of storeDump.records) {
      const value = deserialise(record.value);
      const key = deserialise(record.key) as IDBValidKey | undefined;
      if (storeDump.keyPath) {
        store.put(value);
      } else {
        store.put(value, key);
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Failed to populate store: ${storeDump.name}`));
  });
}

function restoreDB(dbDump: DatabaseDump): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open(dbDump.name, dbDump.version);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const storeDump of dbDump.objectStores) {
        const opts: IDBObjectStoreParameters = { autoIncrement: storeDump.autoIncrement };
        if (storeDump.keyPath !== null && storeDump.keyPath !== undefined) {
          opts.keyPath = storeDump.keyPath;
        }
        const store = db.createObjectStore(storeDump.name, opts);
        for (const idx of storeDump.indexes) {
          store.createIndex(idx.name, idx.keyPath, {
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          });
        }
      }
    };

    req.onsuccess = async () => {
      const db = req.result;
      try {
        for (const storeDump of dbDump.objectStores) {
          if (storeDump.records.length > 0) {
            await populateStore(db, storeDump);
          }
        }
        db.close();
        resolve();
      } catch (err) {
        db.close();
        reject(err);
      }
    };

    req.onerror = () => reject(new Error(`Failed to open database for restore: ${dbDump.name}`));
  });
}

export async function restoreIndexedDB(): Promise<boolean> {
  try {
    if (!existsSync(DUMP_FILE)) {
      logger.info('No crypto store dump found, starting with fresh keys');
      return false;
    }

    const raw = await readFile(DUMP_FILE, 'utf8');
    if (raw.length > MAX_DUMP_SIZE) {
      logger.error('Crypto store dump file exceeds size limit, starting fresh', {
        size: raw.length,
        limit: MAX_DUMP_SIZE,
      });
      return false;
    }
    let dump: IndexedDBDump;
    try {
      dump = JSON.parse(raw) as IndexedDBDump;
    } catch {
      logger.warn('Crypto store dump is corrupted, starting fresh');
      return false;
    }

    if (!dump || typeof dump !== 'object' || dump.version !== 1 || !Array.isArray(dump.databases)) {
      logger.warn('Crypto store dump has invalid structure, starting fresh');
      return false;
    }

    if (dump.databases.length === 0) {
      logger.info('Empty crypto store dump, starting fresh');
      return false;
    }

    for (const dbDump of dump.databases) {
      if (!dbDump || typeof dbDump.name !== 'string' || !Array.isArray(dbDump.objectStores)) {
        logger.warn('Skipping invalid database in dump', { name: dbDump?.name });
        continue;
      }
      let storeValid = true;
      for (const store of dbDump.objectStores) {
        if (!store || typeof store.name !== 'string' || !Array.isArray(store.records)) {
          logger.warn('Skipping database with invalid object store', { db: dbDump.name, store: store?.name });
          storeValid = false;
          break;
        }
        if (store.records.length > MAX_RECORDS_PER_STORE) {
          logger.warn('Object store exceeds record limit, skipping database', {
            db: dbDump.name,
            store: store.name,
            records: store.records.length,
            limit: MAX_RECORDS_PER_STORE,
          });
          storeValid = false;
          break;
        }
      }
      if (storeValid) {
        await restoreDB(dbDump);
      }
    }

    const totalRecords = dump.databases.reduce(
      (sum, db) => sum + db.objectStores.reduce((s, os) => s + os.records.length, 0), 0,
    );

    logger.info('Crypto store restored from disk', {
      databases: dump.databases.length,
      total_records: totalRecords,
      dumped_at: dump.timestamp,
    });
    return true;
  } catch (err) {
    logger.error('Failed to restore crypto store, starting fresh', { error: String(err) });
    return false;
  }
}
