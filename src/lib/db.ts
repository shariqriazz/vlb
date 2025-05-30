import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { Mutex } from 'async-mutex'; // Import Mutex
import { logError } from './services/logger'; // Assuming logger is needed

// Define the path for the database file within the 'data' directory
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.db');

// Define the Settings interface (can be shared or redefined if needed)
export interface Settings {
  targetRotationRequestCount: number; // Renamed from keyRotationRequestCount
  maxFailureCount: number;
  rateLimitCooldown: number; // seconds
  logRetentionDays: number;
  maxRetries: number;
  failoverDelaySeconds: number; // New setting to control delay before switching to next target
}

// Define DEFAULT_SETTINGS
export const DEFAULT_SETTINGS: Settings = {
  targetRotationRequestCount: 10, // Renamed from keyRotationRequestCount
  maxFailureCount: 3,
  rateLimitCooldown: 60, // 60 seconds
  logRetentionDays: 30,
  maxRetries: 3,
  failoverDelaySeconds: 2, // Default to 2 seconds delay before switching targets
};


let dbInstance: Database | null = null;
const dbInitMutex = new Mutex(); // Create a mutex for initialization

// Function to ensure the data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      logError(error, { context: 'ensureDataDir' });
      throw error; // Re-throw if it's not an 'already exists' error
    }
  }
}

// Function to initialize the database connection and schema
async function initializeDatabase(): Promise<Database> {
  await ensureDataDir(); // Make sure the data directory exists first

  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  // Enable WAL mode for better concurrency
  await db.run('PRAGMA journal_mode = WAL;');

  // Create api_keys table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vertex_targets (
      _id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      location TEXT NOT NULL,
      serviceAccountKeyJson TEXT NOT NULL,
      name TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      lastUsed TEXT, -- ISO 8601 date string
      rateLimitResetAt TEXT, -- ISO 8601 date string
      failureCount INTEGER NOT NULL DEFAULT 0,
      requestCount INTEGER NOT NULL DEFAULT 0,
      dailyRateLimit INTEGER, -- NULL means no limit
      dailyRequestsUsed INTEGER NOT NULL DEFAULT 0,
      lastResetDate TEXT, -- ISO 8601 date string
      isDisabledByRateLimit BOOLEAN NOT NULL DEFAULT FALSE
    );
  `);

  // Create settings table if it doesn't exist (using TEXT for simplicity, could use JSON type if supported)
  // Using a single row with a fixed ID for simplicity
  await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row
      config TEXT NOT NULL
    );
  `);

  // Initialize settings using INSERT OR IGNORE to prevent constraint errors on concurrent initializations
  const result = await db.run('INSERT OR IGNORE INTO settings (id, config) VALUES (?, ?)', 1, JSON.stringify(DEFAULT_SETTINGS));
  // Check if result and result.changes are defined before accessing
  if (result && result.changes !== undefined && result.changes > 0) {
      console.log('Initialized default settings in the database.');
  }

  // Create request_logs table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS request_logs (
      _id TEXT PRIMARY KEY,
      targetId TEXT NOT NULL,
      timestamp TEXT NOT NULL, -- ISO 8601 format string
      modelUsed TEXT,
      responseTime INTEGER, -- Milliseconds
      statusCode INTEGER NOT NULL,
      isError BOOLEAN NOT NULL DEFAULT FALSE,
      errorType TEXT,
      errorMessage TEXT,
      ipAddress TEXT,
      promptTokens INTEGER, -- Added
      completionTokens INTEGER, -- Added
      totalTokens INTEGER, -- Added
      isStreaming BOOLEAN, -- Added
      requestId TEXT, -- Added
      requestedModel TEXT, -- Added
      FOREIGN KEY (targetId) REFERENCES vertex_targets(_id) ON DELETE CASCADE -- Enforce FK and cascade deletes
    );
  `);

  // Create indexes for faster querying
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs (timestamp);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_request_logs_targetId ON request_logs (targetId);`);


  console.log(`Database initialized successfully at ${DB_FILE}`);
  return db;
}

// Function to get the database instance (singleton pattern with mutex)
export async function getDb(): Promise<Database> {
  // Quick check first (most calls will hit this)
  if (dbInstance) {
    return dbInstance;
  }

  // If instance doesn't exist, acquire lock to initialize
  return await dbInitMutex.runExclusive(async () => {
    // Double-check inside the lock in case another process initialized it
    // while this one was waiting for the lock
    if (dbInstance) {
      return dbInstance;
    }

    // Proceed with initialization
    try {
      console.log("Attempting database initialization..."); // Add log
      dbInstance = await initializeDatabase();
      console.log("Database initialization successful."); // Add log
      return dbInstance;
    } catch (error) {
      logError(error, { context: 'getDb initialization' });
      console.error('Failed to initialize database:', error);
      // Depending on the desired behavior, you might want to exit the process
      // or handle this error more gracefully.
      process.exit(1); // Exit if DB connection fails critically
    }
  });
}

// Remove this duplicate export at the end of the file
// export { DEFAULT_SETTINGS };