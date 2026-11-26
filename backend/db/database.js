const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const { runMigrations } = require('./migrations');

const DEFAULT_DB_PATH = path.join(__dirname, 'caresync.db');
let db;
let activeDbPath = process.env.CARESYNC_DB_PATH || DEFAULT_DB_PATH;

function getDB() {
  if (!db) {
    db = new DatabaseSync(activeDbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');

    db.transaction = function (fn) {
      return function (...args) {
        db.exec('BEGIN IMMEDIATE;');
        try {
          const result = fn(...args);
          db.exec('COMMIT;');
          return result;
        } catch (err) {
          try {
            db.exec('ROLLBACK;');
          } catch (_) {}
          throw err;
        }
      };
    };
  }
  return db;
}

function initializeDatabase(customPath = null) {
  if (customPath && customPath !== activeDbPath) {
    if (db) {
      try { db.close(); } catch (_) {}
      db = null;
    }
    activeDbPath = customPath;
  }

  const database = getDB();

  // Base tables (kept compatible with fresh installs before migrations run)
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('patient', 'doctor', 'staff', 'admin')) NOT NULL DEFAULT 'patient',
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctor_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      specialization TEXT NOT NULL,
      experience_years INTEGER NOT NULL DEFAULT 0,
      consultation_fee REAL NOT NULL DEFAULT 500,
      available_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '17:00',
      bio TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending','confirmed','completed','cancelled')) DEFAULT 'confirmed',
      symptoms TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id),
      FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id),
      UNIQUE(doctor_id, appointment_date, time_slot)
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER UNIQUE NOT NULL,
      diagnosis TEXT NOT NULL,
      medicines TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    );
  `);

  runMigrations(database);
  return database;
}

function closeDB() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = { getDB, initializeDatabase, closeDB };
