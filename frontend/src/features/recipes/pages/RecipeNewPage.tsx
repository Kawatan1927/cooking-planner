import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/apiClient';
import { useCreateRecipe } from '../hooks';
import type { CreateRecipeRequest } from '../types';

interface IngredientFormRow {
  id: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  note: string;
}

interface ValidationErrors {
  name?: string;
  sourcePage?: string;
  baseServings?: string;
  ingredients?: Array<{
    ingredientName?: string;
    quantity?: string;
    unit?: string;
  }>;
}

const createIngredientRow = (): IngredientFormRow => ({
  id: crypto.randomUUID(),
  ingredientName: '',
  quantity: '',
  unit: '',
  note: '',
});

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '1rem',
  boxSizing: 'border-box' as const,
};

const errorTextStyle = {
  margin: '0.5rem 0 0',
  color: '#721c24',
  fontSize: '0.875rem',
};

const numericQuantityPattern = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/;

const isNumericQuantity = (value: string): boolean => numericQuantityPattern.test(value);

const normalizeQuantity = (value: string): number | string => {
  const trimmed = value.trim();
  if (isNumericQuantity(trimmed) && Number(trimmed) > 0) {
    return Number(trimmed);
  }

  return trimmed;
};

const hasValidationErrors = (errors: ValidationErrors): boolean =>
  !!errors.name ||
  !!errors.sourcePage ||
  !!errors.baseServings ||
  (errors.ingredients?.some(
    ingredient => !!ingredient?.ingredientName || !!ingredient?.quantity || !!ingredient?.unit
  ) ??
    false);

export function RecipeNewPage() {
  const navigate = useNavigate();
  const createRecipeMutation = useCreateRecipe();
  const [name, setName] = useState('');
  const [sourceBook, setSourceBook] = useState('');
  const [sourcePage, setSourcePage] = useState('');
  const [baseServings, setBaseServings] = useState('2');
  const [memo, setMemo] = useState('');
  const [ingredients, setIngredients] = useState<IngredientFormRow[]>(() => [
    createIngredientRow(),
  ]);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const handleIngredientChange = (
    index: number,
    field: keyof Omit<IngredientFormRow, 'id'>,
    value: string
  ) => {
    setIngredients(current =>
      current.map((ingredient, currentIndex) =>
        currentIndex === index ? { ...ingredient, [field]: value } : ingredient
      )
    );
  };

  const handleAddIngredient = () => {
    setIngredients(current => [...current, createIngredientRow()]);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(current =>
      current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {
      ingredients: ingredients.map(() => ({})),
    };

    if (!name.trim()) {
      errors.name = 'レシピ名を入力してください。';
    }

    if (!baseServings.trim()) {
      errors.baseServings = '基本人数を入力してください。';
    } else {
      const normalizedBaseServings = Number(baseServings);
      if (!Number.isInteger(normalizedBaseServings) || normalizedBaseServings <= 0) {
        errors.baseServings = '基本人数は1以上の整数で入力してください。';
      }
    }

    if (sourcePage.trim()) {
      const normalizedSourcePage = Number(sourcePage);
      if (!Number.isInteger(normalizedSourcePage) || normalizedSourcePage <= 0) {
        errors.sourcePage = '出典ページは1以上の整数で入力してください。';
      }
    }

    ingredients.forEach((ingredient, index) => {
      if (!ingredient.ingredientName.trim()) {
        errors.ingredients![index].ingredientName = '材料名を入力してください。';
      }

      if (!ingredient.quantity.trim()) {
        errors.ingredients![index].quantity = '分量を入力してください。';
      } else if (
        isNumericQuantity(ingredient.quantity.trim()) &&
        Number(ingredient.quantity.trim()) <= 0
      ) {
        errors.ingredients![index].quantity = '分量は0より大きい値で入力してください。';
      }

      if (!ingredient.unit.trim()) {
        errors.ingredients![index].unit = '単位を入力してください。';
      }
    });

    return errors;
  };

  const buildRequest = (): CreateRecipeRequest => ({
    name: name.trim(),
    sourceBook: sourceBook.trim() || null,
    sourcePage: sourcePage.trim() ? Number(sourcePage) : null,
    baseServings: Number(baseServings),
    memo: memo.trim() || null,
    ingredients: ingredients.map(ingredient => ({
      ingredientName: ingredient.ingredientName.trim(),
      quantity: normalizeQuantity(ingredient.quantity),
      unit: ingredient.unit.trim(),
      note: ingredient.note.trim() || null,
    })),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextValidationErrors = validateForm();
    setValidationErrors(nextValidationErrors);

    if (hasValidationErrors(nextValidationErrors)) {
      return;
    }

    try {
      const response = await createRecipeMutation.mutateAsync(buildRequest());
      navigate(`/recipes/${response.recipeId}`);
    } catch {
      // エラー表示は mutation state を利用する
    }
  };

  const apiErrorMessage =
    createRecipeMutation.error instanceof ApiError
      ? createRecipeMutation.error.message
      : createRecipeMutation.error?.message;

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, marginBottom: '1.5rem' }}>レシピ登録</h1>

      <form onSubmit={handleSubmit}>
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>基本情報</h2>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            <label>
              <span>レシピ名 *</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                style={inputStyle}
              />
              {validationErrors.name && <p style={errorTextStyle}>{validationErrors.name}</p>}
            </label>

            <label>
              <span>出典本</span>
              <input
                value={sourceBook}
                onChange={event => setSourceBook(event.target.value)}
                style={inputStyle}
              />
            </label>

            <label>
              <span>出典ページ</span>
              <input
                type="number"
                min="1"
                step="1"
                value={sourcePage}
                onChange={event => setSourcePage(event.target.value)}
                style={inputStyle}
              />
              {validationErrors.sourcePage && (
                <p style={errorTextStyle}>{validationErrors.sourcePage}</p>
              )}
            </label>

            <label>
              <span>基本人数 *</span>
              <input
                type="number"
                min="1"
                step="1"
                value={baseServings}
                onChange={event => setBaseServings(event.target.value)}
                style={inputStyle}
              />
              {validationErrors.baseServings && (
                <p style={errorTextStyle}>{validationErrors.baseServings}</p>
              )}
            </label>
          </div>

          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span>メモ</span>
            <textarea
              value={memo}
              onChange={event => setMemo(event.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </label>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>材料一覧</h2>
            <button
              type="button"
              onClick={handleAddIngredient}
              style={{
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#0d6efd',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 'bold',
              }}
            >
              材料行を追加
            </button>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {ingredients.map((ingredient, index) => (
              <div
                key={ingredient.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gap: '1rem',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  }}
                >
                  <label>
                    <span>材料名 *</span>
                    <input
                      value={ingredient.ingredientName}
                      onChange={event =>
                        handleIngredientChange(index, 'ingredientName', event.target.value)
                      }
                      style={inputStyle}
                    />
                    {validationErrors.ingredients?.[index]?.ingredientName && (
                      <p style={errorTextStyle}>
                        {validationErrors.ingredients?.[index]?.ingredientName}
                      </p>
                    )}
                  </label>

                  <label>
                    <span>分量 *</span>
                    <input
                      value={ingredient.quantity}
                      onChange={event =>
                        handleIngredientChange(index, 'quantity', event.target.value)
                      }
                      style={inputStyle}
                    />
                    {validationErrors.ingredients?.[index]?.quantity && (
                      <p style={errorTextStyle}>
                        {validationErrors.ingredients?.[index]?.quantity}
                      </p>
                    )}
                  </label>

                  <label>
                    <span>単位 *</span>
                    <input
                      value={ingredient.unit}
                      onChange={event => handleIngredientChange(index, 'unit', event.target.value)}
                      style={inputStyle}
                    />
                    {validationErrors.ingredients?.[index]?.unit && (
                      <p style={errorTextStyle}>{validationErrors.ingredients?.[index]?.unit}</p>
                    )}
                  </label>

                  <label>
                    <span>備考</span>
                    <input
                      value={ingredient.note}
                      onChange={event => handleIngredientChange(index, 'note', event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                </div>

                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(index)}
                    disabled={ingredients.length === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: ingredients.length === 1 ? 'not-allowed' : 'pointer',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      backgroundColor: ingredients.length === 1 ? '#f8d7da' : 'white',
                      color: '#dc3545',
                    }}
                  >
                    この行を削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {apiErrorMessage && (
          <div
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
            }}
          >
            保存に失敗しました。{apiErrorMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={createRecipeMutation.isPending}
            style={{
              padding: '0.75rem 1.5rem',
              cursor: createRecipeMutation.isPending ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#28a745',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: createRecipeMutation.isPending ? 0.7 : 1,
            }}
          >
            {createRecipeMutation.isPending ? '保存中...' : '保存'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/recipes')}
            disabled={createRecipeMutation.isPending}
            style={{
              padding: '0.75rem 1.5rem',
              cursor: createRecipeMutation.isPending ? 'not-allowed' : 'pointer',
              border: '1px solid #6c757d',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#495057',
              fontSize: '1rem',
            }}
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
