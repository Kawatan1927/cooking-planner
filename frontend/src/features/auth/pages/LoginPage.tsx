import { Link } from 'react-router-dom';

export function LoginPage() {
  return (
    <main style={styles.container}>
      <section style={styles.panel}>
        <h1 style={styles.title}>Cooking Planner</h1>
        <p style={styles.text}>Cloudflare Access の認証を通過すると、このアプリを利用できます。</p>
        <Link to="/" style={styles.link}>
          アプリへ戻る
        </Link>
      </section>
    </main>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    backgroundColor: '#f8fafc',
  },
  panel: {
    width: '100%',
    maxWidth: '420px',
    padding: '32px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    textAlign: 'center' as const,
  },
  title: {
    margin: '0 0 12px',
    color: '#111827',
    fontSize: '1.75rem',
  },
  text: {
    margin: '0 0 24px',
    color: '#4b5563',
    lineHeight: 1.6,
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40px',
    padding: '0 16px',
    borderRadius: '6px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontWeight: 700,
    textDecoration: 'none',
  },
} as const;
