'use client';

import { useEffect, useState } from 'react';
import Navigation from '@/components/Navigation';
import ProgressRing from '@/components/ProgressRing';
import Link from 'next/link';

interface Stats {
  totalVocab: number;
  totalLearned: number;
  totalMastered: number;
  studiedToday: number;
  reviewsDueCount: number;
  newWordsToday: number;
  progressPercent: number;
  masteredPercent: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/study')
      .then(res => res.json())
      .then(data => {
        setStats(data.stats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', color: 'var(--slate-400)',
      }}>
        <div className="animate-float" style={{ fontSize: '3rem' }}>🧠</div>
      </div>
    );
  }

  const todayTotal = (stats?.reviewsDueCount || 0) + (stats?.newWordsToday || 0) + (stats?.studiedToday || 0);
  const done = stats?.studiedToday || 0;
  const todayProgressPercent = todayTotal === 0 ? 100 : Math.round((done / todayTotal) * 100);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      {/* Header */}
      <header style={{
        padding: '2rem 1.5rem 1rem',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '1.8rem',
          fontWeight: 800,
          background: 'linear-gradient(135deg, var(--emerald-400), var(--yellow-400))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.25rem',
        }}>
          EnglishForge
        </h1>
        <p style={{ color: 'var(--slate-400)', fontSize: '0.85rem' }}>
          毎日の積み重ねが、あなたの英語力を作る
        </p>
      </header>

      {/* Main Progress */}
      <section className="animate-fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem 1.5rem 2rem',
      }}>
        <ProgressRing
          progress={stats?.progressPercent || 0}
          size={180}
          strokeWidth={10}
          label={`${stats?.progressPercent || 0}%`}
          sublabel="学習進捗"
        />
        <div style={{
          display: 'flex',
          gap: '2rem',
          marginTop: '1.5rem',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
              {stats?.totalLearned || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>学習中</div>
          </div>
          <div style={{ width: '1px', background: 'var(--glass-border)' }} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--yellow-400)' }}>
              {stats?.totalMastered || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>マスター済</div>
          </div>
          <div style={{ width: '1px', background: 'var(--glass-border)' }} />
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--slate-200)' }}>
              {stats?.totalVocab || 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>合計</div>
          </div>
        </div>
      </section>

      {/* Today's Mission */}
      <section style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card animate-fade-in" style={{
          padding: '1.5rem',
          animationDelay: '0.1s',
        }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🎯 今日のミッション
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            marginBottom: '1.25rem',
          }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--yellow-400)' }}>
                {stats?.newWordsToday || 0}
              </div>
              <div className="stat-label">新しい単語</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>
                {stats?.reviewsDueCount || 0}
              </div>
              <div className="stat-label">復習</div>
            </div>
          </div>

          {/* Mission progress bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--slate-400)',
              marginBottom: '0.4rem',
            }}>
              <span>今日のタスク</span>
              <span style={{ fontWeight: 600 }}>{done} / {todayTotal}</span>
            </div>
            <div className="timer-bar">
              <div className="timer-bar-fill timer-fast" style={{ width: `${todayProgressPercent}%` }} />
            </div>
          </div>

          <Link href="/study" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              🚀 学習スタート！
            </button>
          </Link>
        </div>
      </section>

      {/* Quick Actions */}
      <section style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--slate-400)',
          marginBottom: '0.75rem',
          paddingLeft: '0.25rem',
        }}>
          学習モード
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
        }}>
          {[
            { icon: '🎴', label: 'フラッシュカード', desc: '基本復習', mode: 'flashcard', color: 'var(--emerald-400)' },
            { icon: '🔤', label: '選択式クイズ', desc: '4択問題', mode: 'choice', color: 'var(--yellow-400)' },
            { icon: '⌨️', label: 'タイピング', desc: 'スペル練習', mode: 'typing', color: 'var(--slate-200)' },
            { icon: '🤖', label: 'AI応用テスト', desc: 'Gemini連携', mode: 'ai', color: '#a78bfa' },
          ].map((item, i) => (
            <Link
              key={item.mode}
              href={`/study?mode=${item.mode}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                className="glass-card animate-fade-in"
                style={{
                  padding: '1.25rem',
                  cursor: 'pointer',
                  animationDelay: `${0.15 + i * 0.05}s`,
                }}
              >
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>
                  {item.icon}
                </span>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: item.color }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Navigation />
    </div>
  );
}
