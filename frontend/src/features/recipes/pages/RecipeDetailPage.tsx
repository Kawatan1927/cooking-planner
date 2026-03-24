import { useNavigate, useParams } from 'react-router-dom';
import { useAuthToken } from '../../auth/hooks/useAuthToken';
import { RecipeDetail as RecipeDetailComponent } from '../components';

export function RecipeDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const token = useAuthToken();

  if (!id) {
    return (
      <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
        <button type="button" onClick={() => navigate('/recipes')} style={secondaryButtonStyle}>
          レシピ一覧へ戻る
        </button>
        <div style={messageCardStyle}>
          <h1 style={{ marginTop: 0 }}>レシピ詳細</h1>
          <p style={{ marginBottom: 0 }}>レシピIDを特定できませんでした。</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ margin: 0 }}>レシピ詳細</h1>
        <button type="button" onClick={() => navigate('/recipes')} style={secondaryButtonStyle}>
          レシピ一覧へ戻る
        </button>
      </div>

      {!token ? (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
          }}
        >
          <p style={{ margin: 0 }}>レシピ詳細の表示にはログインが必要です。</p>
        </div>
      ) : (
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: '#fff',
          }}
        >
          <RecipeDetailComponent recipeId={id} token={token} />
        </div>
      )}
    </div>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  cursor: 'pointer',
  border: '1px solid #6c757d',
  borderRadius: '4px',
  backgroundColor: 'white',
  color: '#6c757d',
  fontSize: '0.95rem',
};

const messageCardStyle: React.CSSProperties = {
  marginTop: '1rem',
  padding: '1.5rem',
  border: '1px solid #ddd',
  borderRadius: '8px',
  backgroundColor: '#fff',
};
