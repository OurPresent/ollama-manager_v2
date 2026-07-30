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

export const initDb = async () => {
  try {
    const database = await getDb();
    
    // Validate schema file exists
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`Schema file not found at: ${SCHEMA_PATH}`);
    }
    
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    database.exec(schema);
    saveDb();
    console.log('⚡ SQLite Base de Datos inicializada correctamente.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};
