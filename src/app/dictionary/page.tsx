'use client';

import { useEffect, useState, useCallback } from 'react';
import Navigation from '@/components/Navigation';

interface VocabItem {
  id: number;
  english: string;
  japanese: string;
  type: string;
  learn_status: string;
  next_review_date: string | null;
  total_reviews: number | null;
  correct_count: number | null;
  interval_days: number | null;
}

export default function DictionaryPage() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '30',
      });
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await fetch(`/api/vocabulary?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      new: { bg: 'rgba(100,116,139,0.15)', color: 'var(--slate-400)', label: '未学習' },
      learning: { bg: 'rgba(251,191,36,0.15)', color: 'var(--yellow-400)', label: '学習中' },
      mastered: { bg: 'rgba(16,185,129,0.15)', color: 'var(--emerald-400)', label: 'マスター' },
    };
    const s = styles[status] || styles.new;
    return (
      <span style={{
        fontSize: '0.65rem',
        fontWeight: 600,
        padding: '0.15rem 0.5rem',
        borderRadius: '6px',
        background: s.bg,
        color: s.color,
        whiteSpace: 'nowrap',
      }}>
        {s.label}
      </span>
    );
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
          📖 単語一覧
        </h1>
        <p style={{ color: 'var(--slate-400)', fontSize: '0.85rem' }}>
          {total.toLocaleString()} 件の単語・文章
        </p>
      </header>

      {/* Search & Filter */}
      <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="search"
            placeholder="🔍 英語・日本語で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { value: 'all', label: 'すべて' },
            { value: 'word', label: '単語' },
            { value: 'sentence', label: '文章' },
          ].map(f => (
            <button
              key={f.value}
              className={`btn ${typeFilter === f.value ? 'btn-primary' : 'btn-glass'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: '0 1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-400)' }}>
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-400)' }}>
            見つかりませんでした
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((item, i) => (
              <div
                key={item.id}
                className="glass-card animate-fade-in"
                style={{
                  padding: '1rem 1.25rem',
                  animationDelay: `${i * 0.02}s`,
                  cursor: 'default',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.3rem',
                    }}>
                      <span style={{
                        fontSize: '0.6rem',
                        color: 'var(--slate-500)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        #{item.id}
                      </span>
                      <span style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: item.type === 'word' ? 'rgba(251,191,36,0.1)' : 'rgba(16,185,129,0.1)',
                        color: item.type === 'word' ? 'var(--yellow-400)' : 'var(--emerald-400)',
                        fontWeight: 600,
                      }}>
                        {item.type === 'word' ? '単語' : '文章'}
                      </span>
                      {statusBadge(item.learn_status)}
                    </div>
                    <p style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: 'var(--slate-100)',
                      marginBottom: '0.2rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.japanese}
                    </p>
                    <p style={{
                      fontSize: '0.85rem',
                      color: 'var(--yellow-300)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.5,
                    }}>
                      {(() => {
                        if (item.type === 'word') return item.english;
                        
                        let prevWord = items.find(i => i.id === item.id - 1 && i.type === 'word');
                        if (!prevWord && i > 0 && items[i - 1].type === 'word') {
                          prevWord = items[i - 1];
                        }
                        
                        if (!prevWord) return item.english;

                        const rawWord = prevWord.english.replace(/[^a-zA-Z]/g, '');
                        if (!rawWord) return item.english;
                        
                        let regexStr = rawWord;
                        if (rawWord.length > 4) {
                          if (rawWord.endsWith('e') || rawWord.endsWith('y')) {
                            regexStr = rawWord.slice(0, -1) + '[a-z]*';
                          } else {
                            regexStr = rawWord + '[a-z]*';
                          }
                        } else {
                          regexStr = rawWord + '[a-z]*';
                        }
                        
                        try {
                          const regex = new RegExp(`\\b(${regexStr})`, 'gi');
                          const tokens = item.english.split(regex);
                          return (
                            <>
                              {tokens.map((token, idx) => {
                                if (idx % 2 === 1) {
                                  return <span key={idx} style={{ 
                                    color: '#fff', 
                                    background: 'rgba(255, 255, 255, 0.15)', 
                                    padding: '0 0.2rem', 
                                    borderRadius: '4px',
                                    fontWeight: 700 
                                  }}>{token}</span>;
                                }
                                return <span key={idx}>{token}</span>;
                              })}
                            </>
                          );
                        } catch {
                          return item.english;
                        }
                      })()}
                    </p>
                  </div>
                  {item.total_reviews !== null && item.total_reviews > 0 && (
                    <div style={{
                      textAlign: 'right',
                      flexShrink: 0,
                    }}>
                      <div style={{
                        fontSize: '0.7rem',
                        color: 'var(--slate-500)',
                      }}>
                        復習 {item.total_reviews}回
                      </div>
                      {item.next_review_date && (
                        <div style={{
                          fontSize: '0.65rem',
                          color: 'var(--slate-500)',
                          marginTop: '0.15rem',
                        }}>
                          次回: {item.next_review_date}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.5rem',
        }}>
          <button
            className="btn btn-glass"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ fontSize: '0.8rem', opacity: page <= 1 ? 0.4 : 1 }}
          >
            ← 前へ
          </button>
          <span style={{
            fontSize: '0.8rem',
            color: 'var(--slate-400)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {page} / {totalPages}
          </span>
          <button
            className="btn btn-glass"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ fontSize: '0.8rem', opacity: page >= totalPages ? 0.4 : 1 }}
          >
            次へ →
          </button>
        </div>
      )}

      <Navigation />
    </div>
  );
}
