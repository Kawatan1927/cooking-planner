/**
 * OAuth コールバック処理ページ
 *
 * Cognito Hosted UI からリダイレクトされた後に認可コードをトークンと交換し、
 * localStorage に保存してダッシュボードへ遷移します。
 *
 * @see docs/05-architecture-notes.md §2.4
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  exchangeCodeForTokens,
  getAndClearCodeVerifier,
  getCognitoConfig,
  validateAndClearAuthState,
} from '../utils/cognito';

type CallbackStatus = 'loading' | 'error';

function parseCallbackParams(): { code: string | null; errorMessage: string | null } {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    // URLSearchParams.get() はすでにデコードした値を返すため、
    // decodeURIComponent の二重適用は不要
    const msg = errorDescription ?? error;
    return { code: null, errorMessage: `認証がキャンセルされました: ${msg}` };
  }
  if (!code) {
    return {
      code: null,
      errorMessage: '認可コードが見つかりません。ログインをやり直してください。',
    };
  }
  return { code, errorMessage: null };
}

export function CallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // URL パラメータは初回レンダー時に一度だけ評価する（useState の lazy initializer）
  const [{ status: initialStatus, errorMessage: initialErrorMessage }] = useState(() => {
    const { errorMessage } = parseCallbackParams();
    return {
      status: (errorMessage ? 'error' : 'loading') as CallbackStatus,
      errorMessage: errorMessage ?? '',
    };
  });
  const [status, setStatus] = useState<CallbackStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string>(initialErrorMessage);

  const exchanged = useRef(false);

  useEffect(() => {
    if (status !== 'loading') return;
    if (exchanged.current) return;
    exchanged.current = true;

    const { code } = parseCallbackParams();
    if (!code) return;

    const processCallback = async () => {
      try {
        const config = getCognitoConfig();

        // state を検証して CSRF を防ぐ
        const params = new URLSearchParams(window.location.search);
        const receivedState = params.get('state');
        if (!receivedState || !validateAndClearAuthState(receivedState)) {
          setErrorMessage(
            'セキュリティ検証に失敗しました（state 不一致）。ログインをやり直してください。'
          );
          setStatus('error');
          return;
        }

        // PKCE code_verifier を取得してトークンと交換する
        const codeVerifier = getAndClearCodeVerifier() ?? undefined;
        const tokens = await exchangeCodeForTokens(config, code, codeVerifier);
        login(tokens.id_token);
        void navigate('/', { replace: true });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'ログインに失敗しました。');
        setStatus('error');
      }
    };

    void processCallback();
  }, [navigate, status, login]);

  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loadingText}>ログイン中...</p>
          <p style={styles.hint}>しばらくお待ちください。</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.errorBox}>
          <p style={styles.errorTitle}>ログインに失敗しました</p>
          <p style={styles.errorMessage}>{errorMessage}</p>
        </div>
        <button
          style={styles.retryButton}
          onClick={() => void navigate('/login', { replace: true })}
        >
          ログイン画面へ戻る
        </button>
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
  loadingText: {
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
    color: '#1a1a1a',
    margin: '0 0 0.5rem',
  },
  hint: {
    color: '#6b7280',
    margin: 0,
    fontSize: '0.9rem',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '1rem',
    textAlign: 'left' as const,
    marginBottom: '1.5rem',
  },
  errorTitle: {
    margin: '0 0 0.5rem',
    fontWeight: 'bold' as const,
    color: '#dc2626',
  },
  errorMessage: {
    margin: 0,
    color: '#7f1d1d',
    fontSize: '0.875rem',
    wordBreak: 'break-all' as const,
  },
  retryButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
  },
} as const;
