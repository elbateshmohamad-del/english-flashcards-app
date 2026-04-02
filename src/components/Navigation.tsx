'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'ダッシュボード', icon: '📊' },
    { href: '/study', label: '学習する', icon: '🎯' },
    { href: '/dictionary', label: '単語一覧', icon: '📖' },
    { href: '/settings', label: '設定', icon: '⚙️' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'rgba(10, 14, 26, 0.9)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '0.5rem 1rem',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
    }}>
      {links.map(link => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.5rem 1rem',
              borderRadius: '12px',
              textDecoration: 'none',
              color: isActive ? 'var(--emerald-400)' : 'var(--slate-400)',
              background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              transition: 'all 0.3s ease',
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
