/**
 * レシピ登録ページコンポーネント
 *
 * レシピ基本情報と材料一覧を入力するフォームを提供します。
 * 「保存」でPOST /recipesを呼び出し、成功時にレシピ詳細へ遷移します。
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthToken } from '../../auth/hooks/useAuthToken';
import { useCreateRecipe } from '../hooks';
import type { RecipeIngredient } from '../types';

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', '個', '本', '枚', '切れ', '大さじ', '小さじ', '少々', '適量'];

interface IngredientRow extends RecipeIngredient {
  id: number;
}

let ingredientIdCounter = 0;
const newIngredientRow = (): IngredientRow => ({
  id: ++ingredientIdCounter,
  ingredientName: '',
  quantity: 0,
  unit: 'g',
  note: '',
});

/**
 * レシピ登録ページ
 */
export function RecipeNewPage() {
  const navigate = useNavigate();
  const token = useAuthToken();

  // 基本情報
  const [name, setName] = useState('');
  const [sourceBook, setSourceBook] = useState('');
  const [sourcePage, setSourcePage] = useState('');
  const [baseServings, setBaseServings] = useState('2');
  const [memo, setMemo] = useState('');

  // 材料リスト
  const [ingredients, setIngredients] = useState<IngredientRow[]>([newIngredientRow()]);

  const { mutate: createRecipe, isPending, error } = useCreateRecipe({
    token,
    onSuccess: ({ recipeId }) => {
      navigate(`/recipes/${recipeId}`);
    },
  });

  const handleAddIngredient = () => {
    setIngredients(prev => [...prev, newIngredientRow()]);
  };

  const handleRemoveIngredient = (id: number) => {
    setIngredients(prev => prev.filter(row => row.id !== id));
  };

  const handleIngredientChange = (
    id: number,
    field: keyof Omit<IngredientRow, 'id'>,
    value: string
  ) => {
    setIngredients(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        if (field === 'quantity') {
          return { ...row, quantity: parseFloat(value) || 0 };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedPage = sourcePage !== '' ? parseInt(sourcePage, 10) : undefined;
    const parsedServings = parseInt(baseServings, 10) || 1;

    const requestIngredients: RecipeIngredient[] = ingredients
      .filter(row => row.ingredientName.trim() !== '')
      .map(({ ingredientName, quantity, unit, note }) => ({
        ingredientName: ingredientName.trim(),
        quantity,
        unit,
        note: note?.trim() || null,
      }));

    createRecipe({
      name: name.trim(),
      sourceBook: sourceBook.trim() || undefined,
      sourcePage: parsedPage,
      baseServings: parsedServings,
      memo: memo.trim() || undefined,
      ingredients: requestIngredients,
    });
  };

  const handleCancel = () => {
    navigate('/recipes');
  };

  const isSubmitDisabled = isPending || !name.trim() || !token;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>新しいレシピを登録</h1>

      {!token && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
          }}
        >
          <p style={{ margin: 0 }}>
            レシピを登録するにはログインが必要です。
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
          }}
        >
          <p style={{ margin: 0 }}>
            レシピの保存に失敗しました。{error.message && ` (${error.message})`}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* レシピ基本情報 */}
        <section
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>基本情報</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
              レシピ名 <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例: 鶏の照り焼き"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                出典本のタイトル
              </label>
              <input
                type="text"
                value={sourceBook}
                onChange={e => setSourceBook(e.target.value)}
                placeholder="例: 週末の定番おかず"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
                ページ番号
              </label>
              <input
                type="number"
                value={sourcePage}
                onChange={e => setSourcePage(e.target.value)}
                placeholder="例: 34"
                min={1}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
              基本人数
            </label>
            <input
              type="number"
              value={baseServings}
              onChange={e => setBaseServings(e.target.value)}
              min={1}
              style={{ ...inputStyle, width: '120px' }}
            />
            <span style={{ marginLeft: '0.5rem', color: '#666' }}>人分</span>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
              メモ
            </label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="例: 少し甘めなので砂糖控えめが好み"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </section>

        {/* 材料一覧 */}
        <section
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>材料</h2>

          {/* ヘッダー行 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 2fr auto',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              color: '#555',
            }}
          >
            <span>食材名</span>
            <span>分量</span>
            <span>単位</span>
            <span>備考</span>
            <span />
          </div>

          {ingredients.map(row => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 2fr auto',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                type="text"
                value={row.ingredientName}
                onChange={e => handleIngredientChange(row.id, 'ingredientName', e.target.value)}
                placeholder="例: 鶏もも肉"
                style={inputStyle}
              />
              <input
                type="number"
                value={row.quantity === 0 ? '' : row.quantity}
                onChange={e => handleIngredientChange(row.id, 'quantity', e.target.value)}
                placeholder="300"
                min={0}
                step="any"
                style={inputStyle}
              />
              <select
                value={row.unit}
                onChange={e => handleIngredientChange(row.id, 'unit', e.target.value)}
                style={inputStyle}
              >
                {UNIT_OPTIONS.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={row.note ?? ''}
                onChange={e => handleIngredientChange(row.id, 'note', e.target.value)}
                placeholder="例: 薄切り（任意）"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => handleRemoveIngredient(row.id)}
                disabled={ingredients.length === 1}
                style={{
                  padding: '0.25rem 0.5rem',
                  cursor: ingredients.length === 1 ? 'not-allowed' : 'pointer',
                  border: '1px solid #dc3545',
                  borderRadius: '4px',
                  backgroundColor: ingredients.length === 1 ? '#f8d7da' : '#dc3545',
                  color: 'white',
                  opacity: ingredients.length === 1 ? 0.5 : 1,
                }}
              >
                削除
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddIngredient}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              border: '1px dashed #28a745',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: '#28a745',
              fontSize: '0.875rem',
            }}
          >
            ＋ 材料を追加
          </button>
        </section>

        {/* アクションボタン */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '0.75rem 2rem',
              cursor: 'pointer',
              border: '1px solid #6c757d',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#6c757d',
              fontSize: '1rem',
            }}
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            style={{
              padding: '0.75rem 2rem',
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isSubmitDisabled ? '#adb5bd' : '#28a745',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            {isPending ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '1rem',
  boxSizing: 'border-box',
};
