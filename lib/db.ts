import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'students.db');

// Prevent multiple connections in development
const globalForDb = global as unknown as { db: Database.Database };

const db = globalForDb.db || new Database(dbPath);

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

// Initialize database schema
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      grade INTEGER NOT NULL,
      section_count INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      section_number INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('M', 'F')) NOT NULL,
      is_problem_student BOOLEAN DEFAULT 0,
      is_special_class BOOLEAN DEFAULT 0,
      group_name TEXT,
      rank INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_students_class_section ON students(class_id, section_number);
  `);

  // 기존 테이블에 rank 컬럼 추가 (이미 존재하는 경우 무시)
  try {
    db.exec(`ALTER TABLE students ADD COLUMN rank INTEGER;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }

  // 기존 테이블에 is_special_class 컬럼 추가 (이미 존재하는 경우 무시)
  try {
    db.exec(`ALTER TABLE students ADD COLUMN is_special_class BOOLEAN DEFAULT 0;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }

  // 기존 테이블에 is_distributed 컬럼 추가 (반편성 여부)
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN is_distributed BOOLEAN DEFAULT 0;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }

  // 기존 테이블에 previous_section 컬럼 추가 (이전 반 번호)
  try {
    db.exec(`ALTER TABLE students ADD COLUMN previous_section INTEGER;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }

  // 기존 테이블에 parent_class_id 컬럼 추가 (반편성 시 원본 클래스 ID)
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN parent_class_id INTEGER;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }

  // 기존 테이블에 child_class_id 컬럼 추가 (반편성 시 새로운 클래스 ID)
  try {
    db.exec(`ALTER TABLE classes ADD COLUMN child_class_id INTEGER;`);
  } catch (e) {
    // 컬럼이 이미 존재하면 에러 무시
  }
} catch (error) {
  console.error('Database initialization failed:', error);
}

export default db;
