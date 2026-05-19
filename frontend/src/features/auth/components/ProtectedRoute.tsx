import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AUTH_REDIRECT_AFTER_LOGIN_KEY } from '../utils/cognito';

export function ProtectedRoute() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p>認証状態を確認中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    // Cognito Hosted UI へのフルページ遷移で React Router の state が失われるため
    // sessionStorage にリダイレクト先を保存し、CallbackPage で復元する
    sessionStorage.setItem(AUTH_REDIRECT_AFTER_LOGIN_KEY, redirectPath);
    return <Navigate to="/login" replace state={{ from: redirectPath }} />;
  }

  return <Outlet />;
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
} as const;
