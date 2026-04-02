import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'flashcards.db');

function getDb(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  // Create tables if they don't exist
  db.exec(`
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
  
  return db;
}

export function initializeDatabase() {
  const db = getDb();
  
  // Check if vocabulary already loaded
  const count = db.prepare('SELECT COUNT(*) as count FROM vocabulary').get() as { count: number };
  
  if (count.count === 0) {
    const vocabPath = path.join(process.cwd(), 'src', 'data', 'vocabulary.json');
    const vocabData = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
    
    const insert = db.prepare('INSERT OR IGNORE INTO vocabulary (id, english, japanese, type) VALUES (?, ?, ?, ?)');
    const insertMany = db.transaction((items: Array<{ id: number; english: string; japanese: string; type: string }>) => {
      for (const item of items) {
        insert.run(item.id, item.english, item.japanese, item.type);
      }
    });
    
    insertMany(vocabData);
    console.log(`Loaded ${vocabData.length} vocabulary items into database`);
  }
  
  db.close();
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
  
  if (seconds <= 3 * multiplier) return 5;      // Perfect - instant recall
  if (seconds <= 5 * multiplier) return 4;      // Good - fast
  if (seconds <= 8 * multiplier) return 3;      // Hesitated
  if (seconds <= 15 * multiplier) return 2;     // Struggled
  return 1;                         // Very slow
}

interface ReviewResult {
  vocabId: number;
  responseTimeMs: number;
  isCorrect: boolean;
  mode: string;
}

export function processReview(result: ReviewResult) {
  const db = getDb();
  
  const vocab = db.prepare('SELECT type FROM vocabulary WHERE id = ?').get(result.vocabId) as { type: string } | undefined;
  const type = vocab?.type || 'word';

  const quality = calculateQuality(result.responseTimeMs, result.isCorrect, result.mode, type);
  
  // Get or create progress record
  let progress = db.prepare('SELECT * FROM learning_progress WHERE vocab_id = ?').get(result.vocabId) as {
    ease_factor: number;
    interval_days: number;
    repetitions: number;
    total_reviews: number;
    correct_count: number;
  } | undefined;
  
  if (!progress) {
    db.prepare('INSERT INTO learning_progress (vocab_id) VALUES (?)').run(result.vocabId);
    progress = { ease_factor: 2.5, interval_days: 0, repetitions: 0, total_reviews: 0, correct_count: 0 };
  }
  
  let { ease_factor, interval_days, repetitions } = progress;
  
  // SM-2 Algorithm with modifications
  if (quality < 2) {
    // Failed - reset
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
  
  // Update ease factor
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  
  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval_days);
  const nextDateStr = nextDate.toISOString().split('T')[0];
  
  const status = quality >= 4 ? 'mastered' : quality >= 2 ? 'learning' : 'new';
  
  // Update progress
  db.prepare(`
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
  `).run(ease_factor, interval_days, repetitions, nextDateStr, result.responseTimeMs, result.isCorrect ? 1 : 0, status, result.vocabId);
  
  // Log the review
  db.prepare(`
    INSERT INTO review_log (vocab_id, response_time_ms, quality, mode)
    VALUES (?, ?, ?, ?)
  `).run(result.vocabId, result.responseTimeMs, quality, result.mode);
  
  db.close();
  
  return { quality, nextReviewDate: nextDateStr, intervalDays: interval_days };
}

// ===== Compound Learning Pace Control =====

export function getTodayStudyPlan() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  
  
  // Get stats
  const totalVocab = (db.prepare('SELECT COUNT(*) as c FROM vocabulary').get() as { c: number }).c;
  const totalLearned = (db.prepare("SELECT COUNT(*) as c FROM learning_progress WHERE status != 'new'").get() as { c: number }).c;
  const totalMastered = (db.prepare("SELECT COUNT(*) as c FROM learning_progress WHERE status = 'mastered'").get() as { c: number }).c;
  const studiedToday = (db.prepare("SELECT COUNT(DISTINCT vocab_id) as c FROM review_log WHERE date(review_date) = date('now')").get() as { c: number }).c;
  
  // Get reviews due today
  const reviewsDue = db.prepare(`
    SELECT v.*, lp.next_review_date, lp.status, lp.repetitions, lp.interval_days, lp.ease_factor
    FROM learning_progress lp
    JOIN vocabulary v ON v.id = lp.vocab_id
    WHERE lp.next_review_date <= ?
    ORDER BY lp.next_review_date ASC
  `).all(today);
  
  // Get user baseline or default to 20
  const settingStr = (db.prepare("SELECT value FROM settings WHERE key = 'new_words_per_day'").get() as { value: string } | undefined)?.value;
  const baseNewWords = settingStr ? parseInt(settingStr, 10) : 20;

  // Compound learning: determine new words to introduce
  const progressRatio = totalLearned / totalVocab;
  let newWordsToday: number;
  
  if (progressRatio < 0.1) {
    // Phase 1: Slow start (~60% of base)
    newWordsToday = Math.floor(baseNewWords * 0.6);
  } else if (progressRatio < 0.3) {
    // Phase 2: Building momentum (100% of base)
    newWordsToday = baseNewWords;
  } else if (progressRatio < 0.6) {
    // Phase 3: Compound acceleration (150% of base)
    newWordsToday = Math.floor(baseNewWords * 1.5);
  } else {
    // Phase 4: Sprint to finish (110% of base)
    newWordsToday = Math.floor(baseNewWords * 1.1);
  }
  
  // Anti-burnout: Cap if reviews are too many
  const MAX_DAILY_REVIEWS = 100;
  if (reviewsDue.length > MAX_DAILY_REVIEWS) {
    newWordsToday = 0; // Pause new words, focus on review
  } else if (reviewsDue.length > MAX_DAILY_REVIEWS * 0.7) {
    newWordsToday = Math.max(5, Math.floor(newWordsToday * 0.5));
  }
  
  // Get new words (not yet in learning_progress)
  const newWords = db.prepare(`
    SELECT v.* FROM vocabulary v
    LEFT JOIN learning_progress lp ON lp.vocab_id = v.id
    WHERE lp.id IS NULL
    ORDER BY v.id ASC
    LIMIT ?
  `).all(newWordsToday);
  
  db.close();
  
  return {
    reviewCards: reviewsDue,
    newCards: newWords,
    stats: {
      totalVocab,
      totalLearned,
      totalMastered,
      studiedToday,
      reviewsDueCount: reviewsDue.length,
      newWordsToday: newWords.length,
      progressPercent: Math.round((totalLearned / totalVocab) * 100),
      masteredPercent: Math.round((totalMastered / totalVocab) * 100),
    }
  };
}

export function getVocabularyList(page: number = 1, limit: number = 50, search?: string, type?: string) {
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
  
  // Count query
  const countQuery = `
    SELECT COUNT(*) as c
    FROM vocabulary v
    LEFT JOIN learning_progress lp ON lp.vocab_id = v.id
    ${whereClause}
  `;
  const total = (db.prepare(countQuery).get(...countParams) as { c: number }).c;
  
  // Data query
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
  const items = db.prepare(dataQuery).all(...dataParams);
  
  db.close();
  
  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

export function getChoiceOptions(vocabId: number, vocabType: string) {
  const db = getDb();
  
  // Get 3 random wrong answers of the same type
  const wrongOptions = db.prepare(`
    SELECT english FROM vocabulary 
    WHERE id != ? AND type = ?
    ORDER BY RANDOM() 
    LIMIT 3
  `).all(vocabId, vocabType) as { english: string }[];
  
  db.close();
  
  return wrongOptions.map(o => o.english);
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  db.close();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  db.close();
}
