import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'memory.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db: Database | null = null;
let initializationPromise: Promise<Database> | null = null;

export const getDb = async (): Promise<Database> => {
  // Return existing database if already initialized
  if (db) {
    return db;
  }

  // If initialization is in progress, wait for it (prevents race conditions)
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = (async (): Promise<Database> => {
    try {
      const SQL = await initSqlJs();
      
      // Load existing database or create new one
      if (fs.existsSync(DB_PATH)) {
        try {
          const buffer = fs.readFileSync(DB_PATH);
          db = new SQL.Database(buffer);
        } catch (error) {
          console.error('Error reading existing database, creating new one:', error);
          db = new SQL.Database();
        }
      } else {
        db = new SQL.Database();
      }
      
      return db;
    } catch (error) {
      initializationPromise = null; // Reset on error to allow retry
      throw error;
    }
  })();

  return initializationPromise;
};

export const saveDb = () => {
  if (db) {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (error) {
      console.error('Error saving database:', error);
      throw error;
    }
  }
};

const ensureColumn = (database: Database, table: string, column: string, definition: string): void => {
  const info = database.exec(`PRAGMA table_info(${table})`);
  const columns = info[0]?.values.map((row) => String(row[1])) ?? [];
  if (!columns.includes(column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const runMigrations = async (database: Database): Promise<void> => {
  ensureColumn(database, 'agents', 'model', "TEXT DEFAULT ''");
};

const applySchema = async (database: Database): Promise<void> => {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`Schema file not found at: ${SCHEMA_PATH}`);
  }
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  database.exec(schema);
  await runMigrations(database);
};

export const initDb = async () => {
  try {
    const database = await getDb();
    await applySchema(database);
    saveDb();
    console.log('⚡ SQLite Base de Datos inicializada correctamente.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

/** Devuelve el contenido binario actual de la BD (para respaldos). */
export const exportDatabase = (): Buffer => {
  if (!db) throw new Error('Base de datos no inicializada');
  return Buffer.from(db.export());
};

/** Reemplaza la BD en memoria por una copia restaurada y re-aplica el esquema. */
export const replaceDatabase = async (buffer: Buffer): Promise<void> => {
  const SQL = await initSqlJs();
  const restored = new SQL.Database(new Uint8Array(buffer));
  await applySchema(restored);
  db = restored;
  saveDb();
  console.log('⚡ Base de datos restaurada correctamente.');
};

/** Compacta la base de datos (VACUUM) para liberar espacio de filas borradas. */
export const vacuumDb = async (): Promise<void> => {
  const database = await getDb();
  database.exec('VACUUM');
  saveDb();
};

/** Tamaño en bytes del archivo físico de la base de datos. */
export const getDbSizeBytes = async (): Promise<number> => {
  try {
    if (fs.existsSync(DB_PATH)) {
      return fs.statSync(DB_PATH).size;
    }
  } catch (error) {
    console.error('Error leyendo el tamaño de la BD:', error);
  }
  return 0;
};
