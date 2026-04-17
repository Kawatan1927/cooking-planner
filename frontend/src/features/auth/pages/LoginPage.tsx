/**
 * ログイン画面
 *
 * Cognito Hosted UI を使ったログインフローを提供します。
 * ログイン済みの場合は `/` へリダイレクトします。
 *
 * @see docs/02-features-and-screens.md §2.1
 */

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { buildLoginUrl, getCognitoConfig } from '../utils/cognito';

export function LoginPage() {
  const navigate = useNavigate();
  const token = useAuthToken();

  // Cognito 設定を検証してログイン URL を生成（レンダー時に一度だけ計算）
  const { loginUrl, configError } = useMemo(() => {
    try {
      const config = getCognitoConfig();
      return { loginUrl: buildLoginUrl(config), configError: null };
    } catch (err) {
      return {
        loginUrl: null,
        configError: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  // トークンが既にある場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (token) {
      void navigate('/', { replace: true });
    }
  }, [token, navigate]);

  // ログイン済みの場合はリダイレクト中の表示
  if (token) {
    return (
      <div style={styles.container}>
        <p>リダイレクト中...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>料理プランナー</h1>
        <p style={styles.subtitle}>献立・レシピ・買い物リスト管理</p>

        {configError ? (
          <div style={styles.errorBox}>
            <p style={styles.errorTitle}>設定エラー</p>
            <p style={styles.errorMessage}>{configError}</p>
            <p style={styles.errorHint}>
              環境変数 <code>VITE_COGNITO_DOMAIN</code>、<code>VITE_COGNITO_CLIENT_ID</code>、
              <code>VITE_COGNITO_REDIRECT_URI</code> を設定してください。
            </p>
          </div>
        ) : (
          <a href={loginUrl ?? '#'} style={styles.loginButton}>
            ログイン
          </a>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
    padding: '3rem 2.5rem',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center' as const,
  },
  title: {
    margin: '0 0 0.5rem',
    fontSize: '1.75rem',
    fontWeight: 'bold' as const,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '0 0 2rem',
    fontSize: '0.95rem',
    color: '#6b7280',
  },
  loginButton: {
    display: 'inline-block',
    padding: '0.8rem 2.5rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: '6px',
    textDecoration: 'none',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '1rem',
    textAlign: 'left' as const,
  },
  errorTitle: {
    margin: '0 0 0.5rem',
    fontWeight: 'bold' as const,
    color: '#dc2626',
  },
  errorMessage: {
    margin: '0 0 0.75rem',
    color: '#7f1d1d',
    wordBreak: 'break-all' as const,
    fontSize: '0.875rem',
  },
  errorHint: {
    margin: 0,
    color: '#6b7280',
    fontSize: '0.8rem',
  },
} as const;
