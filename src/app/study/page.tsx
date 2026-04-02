'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navigation from '@/components/Navigation';
import Link from 'next/link';

type LearningMode = 'flashcard' | 'choice' | 'typing' | 'ai';
type CardPhase = 'idle' | 'question' | 'answer' | 'result';

interface VocabCard {
  id: number;
  english: string;
  japanese: string;
  type: string;
  status?: string;
}

function renderTypingDiff(expected: string, actual: string) {
  const result = [];
  const maxLen = Math.max(expected.length, actual.length);
  for (let i = 0; i < maxLen; i++) {
    const e = expected[i] || '';
    const a = actual[i] || '';
    if (e.toLowerCase() === a.toLowerCase() && a !== '') {
      result.push(<span key={i} style={{ color: 'var(--emerald-400)' }}>{a}</span>);
    } else {
      result.push(
        <span key={i} style={{ 
          color: '#fff', 
          backgroundColor: 'rgba(244,63,94,0.6)', 
          borderRadius: '2px', 
          padding: '0 2px',
          margin: '0 1px'
        }}>
          {a === '' ? '_' : a}
        </span>
      );
    }
  }
  return <span style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{result}</span>;
}

function StudyContent() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as LearningMode) || 'flashcard';
  
  const [mode, setMode] = useState<LearningMode>(initialMode);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [choiceOptions, setChoiceOptions] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typingInput, setTypingInput] = useState('');
  const [typingResult, setTypingResult] = useState<'correct' | 'wrong' | null>(null);
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 });
  const [reviewResult, setReviewResult] = useState<{ quality: number; intervalDays: number } | null>(null);
  const [aiSentence, setAiSentence] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animClass, setAnimClass] = useState('');
  const [sessionComplete, setSessionComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_TIME = 15000; // 15 seconds

  // Load cards
  useEffect(() => {
    fetch('/api/study')
      .then(res => res.json())
      .then(data => {
        const allCards = [...(data.reviewCards || []), ...(data.newCards || [])];
        // Shuffle
        for (let i = allCards.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }
        setCards(allCards);
        setLoading(false);
        setStartTime(Date.now());
      })
      .catch(() => setLoading(false));
  }, []);

  // Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (phase === 'question') {
      interval = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 50);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, startTime]);

  // Load choice options
  useEffect(() => {
    const card = cards[currentIndex];
    if (mode === 'choice' && card && phase === 'question') {
      fetch(`/api/review?vocabId=${card.id}&type=${card.type}`)
        .then(res => res.json())
        .then(data => {
          const options = [...data.options, card.english];
          // Shuffle options
          for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
          }
          setChoiceOptions(options);
        });
    }
  }, [mode, currentIndex, cards, phase]);

  // AI sentence generation
  useEffect(() => {
    const card = cards[currentIndex];
    if (mode === 'ai' && card && phase === 'question' && !aiSentence) {
      setAiLoading(true);
      fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: card.english, japanese: card.japanese }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.sentence) {
            setAiSentence(data.sentence);
          } else {
            setAiSentence(`「${card.japanese}」を使った文章を英語で作ってください。`);
          }
          setAiLoading(false);
        })
        .catch(() => {
          setAiSentence(`「${card.japanese}」を使った文章を英語で作ってください。`);
          setAiLoading(false);
        });
    }
  }, [mode, currentIndex, cards, phase, aiSentence]);

  const submitReview = useCallback(async (isCorrect: boolean) => {
    const card = cards[currentIndex];
    if (!card) return;

    const responseTimeMs = Date.now() - startTime;

    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocabId: card.id,
          responseTimeMs,
          isCorrect,
          mode,
        }),
      });
      const result = await res.json();
      setReviewResult(result);
      setSessionStats(prev => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
    } catch {
      // Continue even if save fails
    }

    setPhase('result');
    setAnimClass(isCorrect ? 'animate-correct' : 'animate-wrong');
  }, [cards, currentIndex, startTime, mode]);

  const nextCard = useCallback(() => {
    if (currentIndex >= cards.length - 1) {
      setSessionComplete(true);
      return;
    }
    setCurrentIndex(prev => prev + 1);
    setPhase('question');
    setIsFlipped(false);
    setSelectedChoice(null);
    setTypingInput('');
    setTypingResult(null);
    setReviewResult(null);
    setAiSentence(null);
    setAnimClass('');
    setStartTime(Date.now());
    setElapsedMs(0);
  }, [currentIndex, cards.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (mode === 'typing' && phase === 'question') return; // Don't intercept typing

      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'question' && mode === 'flashcard') {
          setIsFlipped(true);
          setPhase('answer');
        } else if (phase === 'result') {
          nextCard();
        }
      }
      if (phase === 'answer' && mode === 'flashcard') {
        if (e.key === '1') submitReview(false);
        if (e.key === '2') submitReview(true);
        if (e.key === '3') submitReview(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, mode, submitReview, nextCard]);

  // Focus typing input
  useEffect(() => {
    if ((mode === 'typing' || mode === 'ai') && phase === 'question' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode, phase, currentIndex]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', color: 'var(--slate-400)',
      }}>
        <div className="animate-float" style={{ fontSize: '3rem' }}>📚</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          今日のタスクは完了です！
        </h1>
        <p style={{ color: 'var(--slate-400)', marginBottom: '2rem' }}>
          復習すべきカードや新しい単語はありません。明日また来てください！
        </p>
        <Link href="/">
          <button className="btn btn-primary btn-lg">ダッシュボードへ</button>
        </Link>
        <Navigation />
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy = sessionStats.total > 0
      ? Math.round((sessionStats.correct / sessionStats.total) * 100)
      : 0;
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '2rem', textAlign: 'center',
      }}>
        <div className="animate-fade-in" style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {accuracy >= 80 ? '🏆' : accuracy >= 50 ? '💪' : '📖'}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          セッション完了！
        </h1>
        <div style={{
          display: 'flex',
          gap: '2rem',
          marginTop: '1.5rem',
          marginBottom: '2rem',
        }}>
          <div className="stat-card" style={{ padding: '1.25rem 2rem' }}>
            <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>
              {sessionStats.correct}
            </div>
            <div className="stat-label">正解</div>
          </div>
          <div className="stat-card" style={{ padding: '1.25rem 2rem' }}>
            <div className="stat-value" style={{ color: 'var(--yellow-400)' }}>
              {accuracy}%
            </div>
            <div className="stat-label">正解率</div>
          </div>
          <div className="stat-card" style={{ padding: '1.25rem 2rem' }}>
            <div className="stat-value" style={{ color: 'var(--slate-200)' }}>
              {sessionStats.total}
            </div>
            <div className="stat-label">合計</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/">
            <button className="btn btn-glass btn-lg">ダッシュボードへ</button>
          </Link>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => window.location.reload()}
          >
            もう一度
          </button>
        </div>
        <Navigation />
      </div>
    );
  }

  const card = cards[currentIndex];
  
  let maxTimeMs = MAX_TIME;
  if (card) {
    let multiplier = 1.0;
    if (card.type === 'sentence') multiplier *= 3.0;
    if (mode === 'typing') multiplier *= 2.0;
    else if (mode === 'ai') multiplier *= 2.5;
    else if (mode === 'choice') multiplier *= 1.5;
    maxTimeMs *= multiplier;
  }

  const timerPercent = Math.max(0, Math.min(100, 100 - (elapsedMs / maxTimeMs) * 100));
  const timerColor = timerPercent > 60 ? 'timer-fast' : timerPercent > 30 ? 'timer-medium' : 'timer-slow';

  const handleChoiceSelect = (chosen: string) => {
    if (selectedChoice) return;
    setSelectedChoice(chosen);
    const isCorrect = chosen === card.english;
    setTimeout(() => submitReview(isCorrect), 600);
  };

  const handleTypingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = typingInput.trim().toLowerCase().replace(/[.\s]+$/, '');
    const target = card.english.trim().toLowerCase().replace(/[.\s]+$/, '');
    const isCorrect = normalized === target;
    setTypingResult(isCorrect ? 'correct' : 'wrong');
    submitReview(isCorrect);
  };

  const modeLabels: Record<LearningMode, string> = {
    flashcard: '🎴 フラッシュカード',
    choice: '🔤 選択式クイズ',
    typing: '⌨️ タイピング',
    ai: '🤖 AI応用テスト',
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.5rem 0.5rem',
      }}>
        <Link href="/" style={{ color: 'var(--slate-400)', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← 戻る
        </Link>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--slate-300)',
          background: 'var(--glass-bg)',
          padding: '0.35rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid var(--glass-border)',
        }}>
          {modeLabels[mode]}
        </span>
        <span style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--slate-300)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Session progress bar */}
      <div style={{ padding: '0.5rem 1.5rem 0' }}>
        <div className="timer-bar" style={{ height: '3px', marginBottom: '0.5rem' }}>
          <div
            className="timer-bar-fill timer-fast"
            style={{
              width: `${((currentIndex) / cards.length) * 100}%`,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      {/* Timer */}
      {phase === 'question' && (
        <div style={{ padding: '0.25rem 1.5rem 0' }}>
          <div className="timer-bar">
            <div
              className={`timer-bar-fill ${timerColor}`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <div style={{
            textAlign: 'right',
            fontSize: '0.7rem',
            color: timerPercent > 30 ? 'var(--slate-500)' : 'var(--rose-400)',
            marginTop: '0.3rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontVariantNumeric: 'tabular-nums',
          }}>
            {(elapsedMs / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {/* Card type badge */}
      {phase !== 'idle' && (
        <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            background: card.type === 'word' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: card.type === 'word' ? 'var(--yellow-400)' : 'var(--emerald-400)',
          }}>
            {card.type === 'word' ? '単語' : '文章'}
          </span>
        </div>
      )}

      {/* Main Card Area */}
      {phase === 'idle' ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '2rem 1.5rem',
          textAlign: 'center',
        }}>
          <div className="glass-card animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--slate-100)' }}>
              学習セッションを開始
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--slate-400)', marginBottom: '2rem' }}>
              以下の学習モードから1つ選んでスタートしてください。
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {(Object.keys(modeLabels) as LearningMode[]).map(m => (
                <button
                  key={m}
                  className={`btn ${mode === m ? 'btn-primary' : 'btn-glass'} btn-lg`}
                  style={{ width: '100%' }}
                  onClick={() => {
                    setMode(m);
                    setPhase('question');
                    setStartTime(Date.now());
                    setElapsedMs(0);
                  }}
                >
                  {modeLabels[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.5rem',
        gap: '1.5rem',
      }}>
        {/* === FLASHCARD MODE === */}
        {mode === 'flashcard' && (
          <>
            <div className={`flashcard-container ${animClass}`}>
              <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
                <div className="flashcard-face">
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--slate-500)',
                    marginBottom: '1rem',
                    fontWeight: 500,
                  }}>
                    日本語
                  </p>
                  <p style={{
                    fontSize: card.japanese.length > 30 ? '1.2rem' : '1.6rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: 1.5,
                    color: 'var(--slate-100)',
                  }}>
                    {card.japanese}
                  </p>
                  {phase === 'question' && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--slate-500)',
                      marginTop: '2rem',
                    }}>
                      <span className="kbd">Space</span> で答えを見る
                    </p>
                  )}
                </div>
                <div className="flashcard-face flashcard-back">
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--emerald-400)',
                    marginBottom: '1rem',
                    fontWeight: 600,
                  }}>
                    English
                  </p>
                  <p style={{
                    fontSize: card.english.length > 40 ? '1.1rem' : '1.5rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: 1.5,
                    color: 'var(--yellow-300)',
                  }}>
                    {card.english}
                  </p>
                  <p style={{
                    fontSize: '0.85rem',
                    color: 'var(--slate-400)',
                    marginTop: '1rem',
                  }}>
                    {card.japanese}
                  </p>
                </div>
              </div>
            </div>

            {phase === 'question' && (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setIsFlipped(true);
                  setPhase('answer');
                }}
                style={{ width: '100%', maxWidth: '400px' }}
              >
                👁️ 答えを見る
              </button>
            )}

            {phase === 'answer' && (
              <div className="animate-fade-in" style={{
                display: 'flex',
                gap: '0.75rem',
                width: '100%',
                maxWidth: '400px',
              }}>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => submitReview(false)}>
                  <span>😓</span> 忘れた <span className="kbd">1</span>
                </button>
                <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => submitReview(true)}>
                  <span>🤔</span> 悩んだ <span className="kbd">2</span>
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => submitReview(true)}>
                  <span>⚡</span> 完璧 <span className="kbd">3</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* === CHOICE MODE === */}
        {mode === 'choice' && (
          <>
            <div className={`glass-card ${animClass}`} style={{
              width: '100%',
              maxWidth: '600px',
              padding: '2.5rem',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--slate-500)',
                marginBottom: '1rem',
                fontWeight: 500,
              }}>
                日本語
              </p>
              <p style={{
                fontSize: card.japanese.length > 30 ? '1.2rem' : '1.6rem',
                fontWeight: 700,
                lineHeight: 1.5,
                color: 'var(--slate-100)',
              }}>
                {card.japanese}
              </p>
            </div>

            {phase === 'question' && (
              <div className="animate-fade-in" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                width: '100%',
                maxWidth: '600px',
              }}>
                {choiceOptions.map((opt, i) => (
                  <button
                    key={i}
                    className={`choice-btn ${
                      selectedChoice
                        ? opt === card.english
                          ? 'correct'
                          : opt === selectedChoice
                            ? 'wrong'
                            : ''
                        : ''
                    }`}
                    onClick={() => handleChoiceSelect(opt)}
                    disabled={!!selectedChoice}
                  >
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.75rem',
                      color: 'var(--slate-500)',
                      marginRight: '0.75rem',
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* === TYPING MODE === */}
        {mode === 'typing' && (
          <>
            <div className={`glass-card ${animClass}`} style={{
              width: '100%',
              maxWidth: '600px',
              padding: '2.5rem',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: 'var(--slate-500)',
                marginBottom: '1rem',
                fontWeight: 500,
              }}>
                日本語を英語で入力してください
              </p>
              <p style={{
                fontSize: card.japanese.length > 30 ? '1.2rem' : '1.6rem',
                fontWeight: 700,
                lineHeight: 1.5,
                color: 'var(--slate-100)',
              }}>
                {card.japanese}
              </p>
            </div>

            {phase === 'question' && (
              <form
                onSubmit={handleTypingSubmit}
                style={{ width: '100%', maxWidth: '600px' }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typingInput}
                    onChange={e => setTypingInput(e.target.value)}
                    placeholder="英語を入力..."
                    style={{ flex: 1, fontSize: '1.1rem' }}
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                  <button type="submit" className="btn btn-primary">
                    確認
                  </button>
                </div>
              </form>
            )}

            {phase === 'result' && typingResult && (
              <div className="animate-fade-in" style={{
                width: '100%',
                maxWidth: '600px',
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: typingResult === 'correct' ? 'var(--emerald-400)' : 'var(--rose-400)',
                  marginBottom: '0.75rem',
                }}>
                  {typingResult === 'correct' ? '✅ 正解！' : '❌ 不正解'}
                </p>
                {typingResult === 'wrong' && (
                  <div style={{
                    background: 'rgba(251, 191, 36, 0.1)',
                    border: '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '0.75rem',
                  }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginBottom: '0.25rem' }}>
                      正解
                    </p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--yellow-300)' }}>
                      {card.english}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginTop: '0.5rem' }}>
                      あなたの回答
                    </p>
                    <p style={{ fontSize: '1.2rem', color: 'var(--slate-200)', marginTop: '0.25rem' }}>
                      {renderTypingDiff(card.english, typingInput)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* === AI MODE === */}
        {mode === 'ai' && (
          <>
            <div className={`glass-card ${animClass}`} style={{
              width: '100%',
              maxWidth: '600px',
              padding: '2.5rem',
              textAlign: 'center',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '1rem' }}>🤖</span>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#a78bfa',
                  fontWeight: 600,
                }}>
                  AIが生成した文章
                </span>
              </div>
              {aiLoading ? (
                <div className="animate-float" style={{
                  fontSize: '2rem',
                  padding: '2rem',
                }}>
                  🧠
                </div>
              ) : (
                <>
                  <p style={{
                    fontSize: '1.3rem',
                    fontWeight: 700,
                    lineHeight: 1.6,
                    color: 'var(--slate-100)',
                    marginBottom: '1rem',
                  }}>
                    {aiSentence}
                  </p>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--slate-500)',
                  }}>
                    ヒント: <span style={{ color: 'var(--yellow-400)' }}>{card.english}</span> を使って英文を作成
                  </p>
                </>
              )}
            </div>

            {phase === 'question' && !aiLoading && (
              <form
                onSubmit={handleTypingSubmit}
                style={{ width: '100%', maxWidth: '600px' }}
              >
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={typingInput}
                    onChange={e => setTypingInput(e.target.value)}
                    placeholder="英語で翻訳してみましょう..."
                    style={{ flex: 1, fontSize: '1.1rem' }}
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                  <button type="submit" className="btn btn-primary">
                    確認
                  </button>
                </div>
              </form>
            )}

            {phase === 'result' && (
              <div className="animate-fade-in" style={{
                width: '100%',
                maxWidth: '600px',
              }}>
                <div style={{
                  background: 'rgba(167, 139, 250, 0.1)',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  textAlign: 'center',
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginBottom: '0.25rem' }}>
                    対象単語
                  </p>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--yellow-300)' }}>
                    {card.english}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                    {card.japanese}
                  </p>
                  {typingInput && (
                    <>
                      <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginTop: '1rem' }}>
                        あなたの回答
                      </p>
                      <p style={{ fontSize: '1.2rem', color: 'var(--slate-200)', marginTop: '0.25rem' }}>
                        {renderTypingDiff(card.english, typingInput)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Review Result & Next Button */}
        {phase === 'result' && reviewResult && (
          <div className="animate-fade-in" style={{
            textAlign: 'center',
            width: '100%',
            maxWidth: '400px',
          }}>
            <p style={{
              fontSize: '0.8rem',
              color: 'var(--slate-400)',
              marginBottom: '1rem',
            }}>
              次の復習: <span style={{
                fontWeight: 600,
                color: reviewResult.intervalDays <= 1 ? 'var(--rose-400)' :
                  reviewResult.intervalDays <= 3 ? 'var(--yellow-400)' : 'var(--emerald-400)',
              }}>
                {reviewResult.intervalDays <= 1 ? '明日' : `${reviewResult.intervalDays}日後`}
              </span>
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={nextCard}
              style={{ width: '100%' }}
            >
              次へ <span style={{ padding: '0.1rem 0.5rem', background: 'rgba(10,14,26,0.2)', border: '1px solid rgba(10,14,26,0.3)', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--navy-950)' }}>Enter</span>
            </button>
          </div>
        )}

        {/* Mode Switcher */}
        {phase === 'question' && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: '1rem',
          }}>
            {(['flashcard', 'choice', 'typing', 'ai'] as LearningMode[]).map(m => (
              <button
                key={m}
                className={`btn ${mode === m ? 'btn-primary' : 'btn-glass'}`}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                onClick={() => {
                  setMode(m);
                  setPhase('question');
                  setIsFlipped(false);
                  setSelectedChoice(null);
                  setTypingInput('');
                  setTypingResult(null);
                  setAiSentence(null);
                  setStartTime(Date.now());
                }}
              >
                {modeLabels[m]}
              </button>
            ))}
          </div>
        )}
      </div>
      )}

      <Navigation />
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div className="animate-float" style={{ fontSize: '3rem' }}>📚</div>
      </div>
    }>
      <StudyContent />
    </Suspense>
  );
}
