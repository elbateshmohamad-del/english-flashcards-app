'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newWordsPerDay, setNewWordsPerDay] = useState('20');

  useEffect(() => {
    // Load existing settings
    fetch('/api/settings?key=gemini_api_key')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          setSavedKey(data.value);
          setApiKey(data.value);
        }
      });

    fetch('/api/settings?key=new_words_per_day')
      .then(res => res.json())
      .then(data => {
        if (data.value) setNewWordsPerDay(data.value);
      });
  }, []);

  const saveApiKey = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'gemini_api_key', value: apiKey }),
      });
      setSavedKey(apiKey);
      setMessage({ type: 'success', text: 'APIキーを保存しました！' });
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました' });
    }
    setSaving(false);
  };

  const saveNewWordsPerDay = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'new_words_per_day', value: newWordsPerDay }),
      });
      setMessage({ type: 'success', text: '設定を保存しました！' });
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '100px' }}>
      <header style={{ padding: '2rem 1.5rem 1rem' }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: 'var(--slate-100)',
          marginBottom: '0.25rem',
        }}>
          ⚙️ 設定
        </h1>
        <p style={{ color: 'var(--slate-400)', fontSize: '0.85rem' }}>
          学習の設定とAI連携の管理
        </p>
      </header>

      {message && (
        <div style={{
          margin: '0 1.5rem 1rem',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: message.type === 'success'
            ? 'rgba(16, 185, 129, 0.15)'
            : 'rgba(244, 63, 94, 0.15)',
          border: `1px solid ${message.type === 'success' ? 'var(--emerald-400)' : 'var(--rose-400)'}`,
          color: message.type === 'success' ? 'var(--emerald-400)' : 'var(--rose-400)',
          fontSize: '0.85rem',
        }}>
          {message.text}
        </div>
      )}

      {/* Gemini API Key */}
      <section style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🤖 Gemini API キー
          </h2>
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--slate-400)',
            marginBottom: '1rem',
            lineHeight: 1.6,
          }}>
            AI応用テストモードを使用するために、Google Gemini APIキーを設定します。
            APIキーは{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--emerald-400)', textDecoration: 'underline' }}
            >
              Google AI Studio
            </a>
            {' '}から無料で取得できます。
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIza..."
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={saveApiKey}
              disabled={saving || !apiKey}
              style={{ opacity: saving || !apiKey ? 0.5 : 1 }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
          {savedKey && (
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--emerald-400)',
              marginTop: '0.5rem',
            }}>
              ✅ APIキーが設定済みです
            </p>
          )}
        </div>
      </section>

      {/* Learning Settings */}
      <section style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            📊 学習ペース設定
          </h2>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              fontSize: '0.85rem',
              color: 'var(--slate-300)',
              display: 'block',
              marginBottom: '0.4rem',
            }}>
              1日の新規単語数（目安）
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={newWordsPerDay}
                onChange={e => setNewWordsPerDay(e.target.value)}
                style={{ width: '80px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-400)' }}>語 / 日</span>
              <button className="btn btn-glass" onClick={saveNewWordsPerDay} style={{ fontSize: '0.8rem' }}>
                保存
              </button>
            </div>
            <p style={{
              fontSize: '0.7rem',
              color: 'var(--slate-500)',
              marginTop: '0.4rem',
            }}>
              ※ 複利型システムにより、実際のペースはあなたの進捗状況に応じて自動調整されます
            </p>
          </div>
        </div>
      </section>

      {/* App Info */}
      <section style={{ padding: '0 1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            ℹ️ アプリについて
          </h2>
          <div style={{
            display: 'grid',
            gap: '0.5rem',
            fontSize: '0.85rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-400)' }}>アプリ名</span>
              <span style={{ color: 'var(--slate-200)', fontWeight: 600 }}>EnglishForge</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-400)' }}>バージョン</span>
              <span style={{ color: 'var(--slate-200)' }}>1.0.0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-400)' }}>学習方式</span>
              <span style={{ color: 'var(--emerald-400)' }}>複利型 Spaced Repetition</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--slate-400)' }}>AI機能</span>
              <span style={{ color: '#a78bfa' }}>Gemini API</span>
            </div>
          </div>
        </div>
      </section>

      <Navigation />
    </div>
  );
}
