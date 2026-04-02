import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';

let _db: Client | null = null;

export function getDb(): Client {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL || 'file:' + path.join(process.cwd(), 'data', 'flashcards.db');
  
  if (url.startsWith('file:')) {
    const dbPath = url.replace('file:', '');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  
  return _db;
}

export async function initializeDatabase() {
  const db = getDb();
  
  // Create tables if they don't exist
  // executeMultiple is available in @libsql/client for multi-statement queries
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS vocabulary (
      id INTEGER PRIMARY KEY,
      english TEXT NOT NULL,
      japanese TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'word'
    );

    CREATE TABLE IF NOT EXISTS learning_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocab_id INTEGER NOT NULL UNIQUE,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review_date TEXT NOT NULL DEFAULT (date('now')),
      last_review_date TEXT,
      last_response_time_ms INTEGER,
      total_reviews INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      FOREIGN KEY (vocab_id) REFERENCES vocabulary(id)
    );

    CREATE TABLE IF NOT EXISTS review_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vocab_id INTEGER NOT NULL,
      review_date TEXT NOT NULL DEFAULT (datetime('now')),
      response_time_ms INTEGER NOT NULL,
      quality INTEGER NOT NULL,
      mode TEXT NOT NULL DEFAULT 'flashcard',
      FOREIGN KEY (vocab_id) REFERENCES vocabulary(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_progress_next_review ON learning_progress(next_review_date);
    CREATE INDEX IF NOT EXISTS idx_progress_status ON learning_progress(status);
    CREATE INDEX IF NOT EXISTS idx_review_log_date ON review_log(review_date);
  `);
  
  // Check if vocabulary already loaded
  const countRes = await db.execute('SELECT COUNT(*) as count FROM vocabulary');
  const count = Number(countRes.rows[0].count);
  
  if (count === 0) {
    const vocabPath = path.join(process.cwd(), 'src', 'data', 'vocabulary.json');
    if (fs.existsSync(vocabPath)) {
      const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
      
      const stmts = vocabData.map((item: any) => ({
        sql: 'INSERT OR IGNORE INTO vocabulary (id, english, japanese, type) VALUES (?, ?, ?, ?)',
        args: [item.id, item.english, item.japanese, item.type]
      }));
      
      const chunkSize = 100;
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await db.batch(stmts.slice(i, i + chunkSize), 'write');
      }
      console.log(`Loaded ${vocabData.length} vocabulary items into database`);
    }
  }
}

// ===== Spaced Repetition System (SM-2 variant with time-based grading) =====

function calculateQuality(responseTimeMs: number, isCorrect: boolean, mode: string, type: string): number {
  if (!isCorrect) return 0;
  
  const seconds = responseTimeMs / 1000;
  
  let multiplier = 1.0;
  if (type === 'sentence') multiplier *= 3.0;
  
  if (mode === 'typing') multiplier *= 2.0;
  else if (mode === 'ai') multiplier *= 2.5;
  else if (mode === 'choice') multiplier *= 1.5;
  
  if (seconds <= 3 * multiplier) return 5;
  if (seconds <= 5 * multiplier) return 4;
  if (seconds <= 8 * multiplier) return 3;
  if (seconds <= 15 * multiplier) return 2;
  return 1;
}

export interface ReviewResult {
  vocabId: number;
  responseTimeMs: number;
  isCorrect: boolean;
  mode: string;
}

export async function processReview(result: ReviewResult) {
  const db = getDb();
  
  const vocabRes = await db.execute({
    sql: 'SELECT type FROM vocabulary WHERE id = ?',
    args: [result.vocabId]
  });
  const type = (vocabRes.rows[0]?.type as string) || 'word';

  const quality = calculateQuality(result.responseTimeMs, result.isCorrect, result.mode, type);
  
  // Get or create progress record
  const progressRes = await db.execute({
    sql: 'SELECT * FROM learning_progress WHERE vocab_id = ?',
    args: [result.vocabId]
  });
  
  let progress = progressRes.rows[0] as any;
  
  if (!progress) {
    await db.execute({
      sql: 'INSERT INTO learning_progress (vocab_id) VALUES (?)',
      args: [result.vocabId]
    });
    progress = { ease_factor: 2.5, interval_days: 0, repetitions: 0, total_reviews: 0, correct_count: 0 };
  }
  
  let ease_factor = Number(progress.ease_factor);
  let interval_days = Number(progress.interval_days);
  let repetitions = Number(progress.repetitions);
  
  // SM-2 Algorithm with modifications
  if (quality < 2) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 3;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
  }
  
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval_days);
  const nextDateStr = nextDate.toISOString().split('T')[0];
  
  const status = quality >= 4 ? 'mastered' : quality >= 2 ? 'learning' : 'new';
  
  await db.execute({
    sql: `
      UPDATE learning_progress SET
        ease_factor = ?,
        interval_days = ?,
        repetitions = ?,
        next_review_date = ?,
        last_review_date = date('now'),
        last_response_time_ms = ?,
        total_reviews = total_reviews + 1,
        correct_count = correct_count + ?,
        status = ?
      WHERE vocab_id = ?
    `,
    args: [ease_factor, interval_days, repetitions, nextDateStr, result.responseTimeMs, result.isCorrect ? 1 : 0, status, result.vocabId]
  });
  
  await db.execute({
    sql: `
      INSERT INTO review_log (vocab_id, response_time_ms, quality, mode)
      VALUES (?, ?, ?, ?)
    `,
    args: [result.vocabId, result.responseTimeMs, quality, result.mode]
  });
  
  return { quality, nextReviewDate: nextDateStr, intervalDays: interval_days };
}

// ===== Compound Learning Pace Control =====

export async function getTodayStudyPlan() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  
  const [totalVocabRes, totalLearnedRes, totalMasteredRes, studiedTodayRes] = await db.batch([
    'SELECT COUNT(*) as c FROM vocabulary',
    "SELECT COUNT(*) as c FROM learning_progress WHERE status != 'new'",
    "SELECT COUNT(*) as c FROM learning_progress WHERE status = 'mastered'",
    "SELECT COUNT(DISTINCT vocab_id) as c FROM review_log WHERE date(review_date) = date('now')"
  ], 'read');
  
  const totalVocab = Number(totalVocabRes.rows[0].c);
  const totalLearned = Number(totalLearnedRes.rows[0].c);
  const totalMastered = Number(totalMasteredRes.rows[0].c);
  const studiedToday = Number(studiedTodayRes.rows[0].c);
  
  const reviewsDueRes = await db.execute({
    sql: `
      SELECT v.*, lp.next_review_date, lp.status, lp.repetitions, lp.interval_days, lp.ease_factor
      FROM learning_progress lp
      JOIN vocabulary v ON v.id = lp.vocab_id
      WHERE lp.next_review_date <= ?
      ORDER BY lp.next_review_date ASC
    `,
    args: [today]
  });
  const reviewsDue = reviewsDueRes.rows;
  
  const settingRes = await db.execute("SELECT value FROM settings WHERE key = 'new_words_per_day'");
  const settingStr = settingRes.rows.length > 0 ? (settingRes.rows[0].value as string) : undefined;
  const baseNewWords = settingStr ? parseInt(settingStr, 10) : 20;

  const progressRatio = totalVocab > 0 ? totalLearned / totalVocab : 0;
  let newWordsToday: number;
  
  if (progressRatio < 0.1) {
    newWordsToday = Math.floor(baseNewWords * 0.6);
  } else if (progressRatio < 0.3) {
    newWordsToday = baseNewWords;
  } else if (progressRatio < 0.6) {
    newWordsToday = Math.floor(baseNewWords * 1.5);
  } else {
    newWordsToday = Math.floor(baseNewWords * 1.1);
  }
  
  const MAX_DAILY_REVIEWS = 100;
  if (reviewsDue.length > MAX_DAILY_REVIEWS) {
    newWordsToday = 0; 
  } else if (reviewsDue.length > MAX_DAILY_REVIEWS * 0.7) {
    newWordsToday = Math.max(5, Math.floor(newWordsToday * 0.5));
  }
  
  const newWordsRes = await db.execute({
    sql: `
      SELECT v.* FROM vocabulary v
      LEFT JOIN learning_progress lp ON lp.vocab_id = v.id
      WHERE lp.id IS NULL
      ORDER BY v.id ASC
      LIMIT ?
    `,
    args: [newWordsToday]
  });
  const newCards = newWordsRes.rows;
  
  return {
    reviewCards: reviewsDue,
    newCards: newCards,
    stats: {
      totalVocab,
      totalLearned,
      totalMastered,
      studiedToday,
      reviewsDueCount: reviewsDue.length,
      newWordsToday: newCards.length,
      progressPercent: totalVocab > 0 ? Math.round((totalLearned / totalVocab) * 100) : 0,
      masteredPercent: totalVocab > 0 ? Math.round((totalMastered / totalVocab) * 100) : 0,
    }
  };
}

export async function getVocabularyList(page: number = 1, limit: number = 50, search?: string, type?: string) {
  const db = getDb();
  
  let whereClause = 'WHERE 1=1';
  const countParams: (string | number)[] = [];
  
  if (search) {
    whereClause += ` AND (v.english LIKE ? OR v.japanese LIKE ?)`;
    countParams.push(`%${search}%`, `%${search}%`);
  }
  if (type && type !== 'all') {
    whereClause += ` AND v.type = ?`;
    countParams.push(type);
  }
  
  const countQuery = `
    SELECT COUNT(*) as c
    FROM vocabulary v
    LEFT JOIN learning_progress lp ON lp.vocab_id = v.id
    ${whereClause}
  `;
  const countRes = await db.execute({ sql: countQuery, args: countParams });
  const total = Number(countRes.rows[0].c);
  
  const dataQuery = `
    SELECT v.*, 
      COALESCE(lp.status, 'new') as learn_status,
      lp.next_review_date,
      lp.total_reviews,
      lp.correct_count,
      lp.interval_days
    FROM vocabulary v
    LEFT JOIN learning_progress lp ON lp.vocab_id = v.id
    ${whereClause}
    ORDER BY v.id ASC LIMIT ? OFFSET ?
  `;
  const dataParams = [...countParams, limit, (page - 1) * limit];
  const itemsRes = await db.execute({ sql: dataQuery, args: dataParams });
  
  return { items: itemsRes.rows, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getChoiceOptions(vocabId: number, vocabType: string) {
  const db = getDb();
  
  const wrongOptionsRes = await db.execute({
    sql: `
      SELECT english FROM vocabulary 
      WHERE id != ? AND type = ?
      ORDER BY RANDOM() 
      LIMIT 3
    `,
    args: [vocabId, vocabType]
  });
  
  return wrongOptionsRes.rows.map((o: any) => o.english as string);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  const res = await db.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key]
  });
  return res.rows.length > 0 ? (res.rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string) {
  const db = getDb();
  await db.execute({
    sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    args: [key, value]
  });
}
