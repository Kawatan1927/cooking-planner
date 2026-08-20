/**
 * アプリ共通レイアウト
 *
 * ヘッダー＋コンテンツ領域を提供します。
 * `/login` / `/callback` を除く全ページで使用されます。
 *
 * variant:
 *   - "default"  : 通常レイアウト（ヘッダー + コンテンツ）
 *   - "focus"    : 買い物リストなどチェック操作向け（将来の拡張用）
 *
 * @see docs/docs/features/screens.md
 */

import { Outlet } from 'react-router-dom';
import { Header } from './Header';

interface AppLayoutProps {
  variant?: 'default' | 'focus';
}

export function AppLayout({ variant = 'default' }: AppLayoutProps) {
  return (
    <div style={styles.root}>
      <Header />
      <main
        style={{
          ...styles.main,
          ...(variant === 'focus' ? styles.mainFocus : {}),
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: '960px',
    margin: '0 auto',
    padding: '16px',
    boxSizing: 'border-box' as const,
  },
  /** 買い物リストなど集中操作用：上下パディングを抑えてスクロール量を最小化 */
  mainFocus: {
    paddingTop: '8px',
    paddingBottom: '8px',
  },
} as const;
