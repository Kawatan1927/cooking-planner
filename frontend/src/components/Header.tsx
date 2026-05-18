/**
 * アプリ共通ヘッダー
 *
 * 主要ナビゲーション（ダッシュボード・レシピ・献立・買い物リスト）を提供します。
 * sticky 配置で常に画面上部に固定されます。
 *
 * @see docs/02-features-and-screens.md
 */

import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'ダッシュボード' },
  { to: '/recipes', label: 'レシピ' },
  { to: '/menus', label: '献立' },
  { to: '/shopping-list', label: '買い物リスト' },
] as const;

export function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.inner}>
        {/* 左：アプリ名 */}
        <span style={styles.brand}>Cooking Planner</span>

        {/* 中：主要ナビ */}
        <nav style={styles.nav} aria-label="主要ナビゲーション">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* 右：将来のユーザー/ログアウト表示枠（認証統合で実装） */}
        <div style={styles.userArea} aria-label="ユーザーエリア" />
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    height: '56px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e0e0e0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    maxWidth: '960px',
    margin: '0 auto',
    padding: '0 16px',
    gap: '16px',
  },
  brand: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#1a1a2e',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
    overflowX: 'auto' as const,
  },
  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '40px',
    padding: '0 12px',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#444',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    transition: 'background-color 0.15s, color 0.15s',
  },
  navLinkActive: {
    color: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  userArea: {
    flexShrink: 0,
    width: '32px',
  },
} as const;
