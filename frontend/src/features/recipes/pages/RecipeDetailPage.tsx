import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/lib/apiClient';
import { useRecipe, useUpdateRecipe } from '../hooks';
import type { RecipeDetail, UpdateRecipeRequest } from '../types';

interface IngredientFormRow {
  id: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  note: string;
}

interface RecipeFormState {
  name: string;
  sourceBook: string;
  sourcePage: string;
  baseServings: string;
  memo: string;
  ingredients: IngredientFormRow[];
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

const createIngredientRow = (
  ingredient: Partial<Omit<IngredientFormRow, 'id'>> = {}
): IngredientFormRow => ({
  id: crypto.randomUUID(),
  ingredientName: ingredient.ingredientName ?? '',
  quantity: ingredient.quantity ?? '',
  unit: ingredient.unit ?? '',
  note: ingredient.note ?? '',
});

const mapRecipeToFormState = (recipe: RecipeDetail): RecipeFormState => ({
  name: recipe.name,
  sourceBook: recipe.sourceBook ?? '',
  sourcePage: recipe.sourcePage?.toString() ?? '',
  baseServings: recipe.baseServings.toString(),
  memo: recipe.memo ?? '',
  ingredients:
    recipe.ingredients.length > 0
      ? recipe.ingredients.map(ingredient =>
          createIngredientRow({
            ingredientName: ingredient.ingredientName,
            quantity: String(ingredient.quantity),
            unit: ingredient.unit,
            note: ingredient.note ?? '',
          })
        )
      : [createIngredientRow()],
});

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

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return <RecipeDetailPageContent key="missing-recipe" recipeId="" />;
  }

  return <RecipeDetailPageContent key={id} recipeId={id} />;
}

interface RecipeDetailPageContentProps {
  recipeId: string;
}

function RecipeDetailPageContent({ recipeId }: RecipeDetailPageContentProps) {
  const navigate = useNavigate();
  const recipeQuery = useRecipe({ recipeId });
  const updateRecipeMutation = useUpdateRecipe({ recipeId });
  const [draftFormState, setDraftFormState] = useState<RecipeFormState | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const initialFormState = useMemo(
    () => (recipeQuery.data ? mapRecipeToFormState(recipeQuery.data) : null),
    [recipeQuery.data]
  );
  const formState = draftFormState ?? initialFormState;

  const apiError = recipeQuery.error instanceof ApiError ? recipeQuery.error : null;
  const isNotFound =
    !recipeId || (apiError?.statusCode === 404 && apiError.code === 'RECIPE_NOT_FOUND');

  const updateField = <K extends keyof Omit<RecipeFormState, 'ingredients'>>(
    field: K,
    value: RecipeFormState[K]
  ) => {
    setDraftFormState(current => {
      const base = current ?? initialFormState;
      return base ? { ...base, [field]: value } : current;
    });
    setSaveMessage(null);
  };

  const handleIngredientChange = (
    index: number,
    field: keyof Omit<IngredientFormRow, 'id'>,
    value: string
  ) => {
    setDraftFormState(current => {
      const base = current ?? initialFormState;
      return base
        ? {
            ...base,
            ingredients: base.ingredients.map((ingredient, currentIndex) =>
              currentIndex === index ? { ...ingredient, [field]: value } : ingredient
            ),
          }
        : current;
    });
    setSaveMessage(null);
  };

  const handleAddIngredient = () => {
    setDraftFormState(current => {
      const base = current ?? initialFormState;
      return base
        ? {
            ...base,
            ingredients: [...base.ingredients, createIngredientRow()],
          }
        : current;
    });
    setValidationErrors(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients ?? []), {}],
    }));
    setSaveMessage(null);
  };

  const handleRemoveIngredient = (index: number) => {
    setDraftFormState(current => {
      const base = current ?? initialFormState;
      return base
        ? {
            ...base,
            ingredients:
              base.ingredients.length === 1
                ? base.ingredients
                : base.ingredients.filter((_, currentIndex) => currentIndex !== index),
          }
        : current;
    });
    setValidationErrors(prev => ({
      ...prev,
      ingredients: prev.ingredients?.filter((_, i) => i !== index),
    }));
    setSaveMessage(null);
  };

  const validateForm = (): ValidationErrors => {
    if (!formState) {
      return {};
    }

    const errors: ValidationErrors = {
      ingredients: formState.ingredients.map(() => ({})),
    };

    if (!formState.name.trim()) {
      errors.name = 'レシピ名を入力してください。';
    }

    if (!formState.baseServings.trim()) {
      errors.baseServings = '基本人数を入力してください。';
    } else {
      const normalizedBaseServings = Number(formState.baseServings);
      if (!Number.isInteger(normalizedBaseServings) || normalizedBaseServings <= 0) {
        errors.baseServings = '基本人数は1以上の整数で入力してください。';
      }
    }

    if (formState.sourcePage.trim()) {
      const normalizedSourcePage = Number(formState.sourcePage);
      if (!Number.isInteger(normalizedSourcePage) || normalizedSourcePage <= 0) {
        errors.sourcePage = '出典ページは1以上の整数で入力してください。';
      }
    }

    formState.ingredients.forEach((ingredient, index) => {
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

  const buildRequest = (): UpdateRecipeRequest | null => {
    if (!formState) {
      return null;
    }

    return {
      name: formState.name.trim(),
      sourceBook: formState.sourceBook.trim() || null,
      sourcePage: formState.sourcePage.trim() ? Number(formState.sourcePage) : null,
      baseServings: Number(formState.baseServings),
      memo: formState.memo.trim() || null,
      ingredients: formState.ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName.trim(),
        quantity: normalizeQuantity(ingredient.quantity),
        unit: ingredient.unit.trim(),
        note: ingredient.note.trim() || null,
      })),
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage(null);

    const nextValidationErrors = validateForm();
    setValidationErrors(nextValidationErrors);

    if (hasValidationErrors(nextValidationErrors)) {
      return;
    }

    const request = buildRequest();
    if (!request) {
      return;
    }

    try {
      await updateRecipeMutation.mutateAsync(request);
      setDraftFormState(null);
      setValidationErrors({});
      setSaveMessage('レシピを保存しました。');
    } catch {
      // エラー表示は mutation state を利用する
    }
  };

  const headerMeta = useMemo(() => {
    if (!recipeQuery.data) {
      return [];
    }

    return [
      recipeQuery.data.sourceBook
        ? `出典: ${recipeQuery.data.sourceBook}${
            recipeQuery.data.sourcePage ? ` p.${recipeQuery.data.sourcePage}` : ''
          }`
        : '出典: 未登録',
      `基本人数: ${recipeQuery.data.baseServings}人分`,
      `最終更新: ${new Date(recipeQuery.data.updatedAt).toLocaleString('ja-JP')}`,
    ];
  }, [recipeQuery.data]);

  if (recipeQuery.isLoading && !formState) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0 }}>レシピ詳細／編集</h1>
        <p>レシピを読み込み中です...</p>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0 }}>レシピが見つかりません</h1>
        <p>指定されたレシピは存在しないか、すでに削除されています。</p>
        <button
          type="button"
          onClick={() => navigate('/recipes')}
          style={{
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            border: '1px solid #6c757d',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#495057',
            fontSize: '1rem',
          }}
        >
          レシピ一覧へ戻る
        </button>
      </div>
    );
  }

  if (recipeQuery.error && !formState) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          color: '#721c24',
        }}
      >
        <h1 style={{ marginTop: 0 }}>レシピを読み込めませんでした</h1>
        <p style={{ marginBottom: '1rem' }}>
          {recipeQuery.error instanceof Error
            ? recipeQuery.error.message
            : '時間をおいて再度お試しください。'}
        </p>
        <button
          type="button"
          onClick={() => recipeQuery.refetch()}
          style={{
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#dc3545',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          再読み込み
        </button>
      </div>
    );
  }

  if (!formState || !recipeQuery.data) {
    return null;
  }

  const updateErrorMessage =
    updateRecipeMutation.error instanceof ApiError
      ? updateRecipeMutation.error.message
      : updateRecipeMutation.error?.message;

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{recipeQuery.data.name}</h1>
          <div style={{ display: 'grid', gap: '0.35rem', color: '#495057' }}>
            {headerMeta.map(item => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/menus')}
          style={{
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            border: '1px solid #0d6efd',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#0d6efd',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          このレシピを献立に追加
        </button>
      </div>

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
                value={formState.name}
                onChange={event => updateField('name', event.target.value)}
                style={inputStyle}
              />
              {validationErrors.name && <p style={errorTextStyle}>{validationErrors.name}</p>}
            </label>

            <label>
              <span>出典本</span>
              <input
                value={formState.sourceBook}
                onChange={event => updateField('sourceBook', event.target.value)}
                style={inputStyle}
              />
            </label>

            <label>
              <span>出典ページ</span>
              <input
                type="number"
                min="1"
                step="1"
                value={formState.sourcePage}
                onChange={event => updateField('sourcePage', event.target.value)}
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
                value={formState.baseServings}
                onChange={event => updateField('baseServings', event.target.value)}
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
              value={formState.memo}
              onChange={event => updateField('memo', event.target.value)}
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
            {formState.ingredients.map((ingredient, index) => (
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
                        {validationErrors.ingredients[index]?.ingredientName}
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
                      <p style={errorTextStyle}>{validationErrors.ingredients[index]?.quantity}</p>
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
                      <p style={errorTextStyle}>{validationErrors.ingredients[index]?.unit}</p>
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
                    disabled={formState.ingredients.length === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: formState.ingredients.length === 1 ? 'not-allowed' : 'pointer',
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      backgroundColor: formState.ingredients.length === 1 ? '#f8d7da' : 'white',
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

        {saveMessage && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#d1e7dd',
              border: '1px solid #badbcc',
              borderRadius: '4px',
              color: '#0f5132',
            }}
          >
            {saveMessage}
          </div>
        )}

        {updateErrorMessage && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '1rem',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
            }}
          >
            保存に失敗しました。{updateErrorMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={updateRecipeMutation.isPending}
            style={{
              padding: '0.75rem 1.5rem',
              cursor: updateRecipeMutation.isPending ? 'not-allowed' : 'pointer',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#28a745',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: updateRecipeMutation.isPending ? 0.7 : 1,
            }}
          >
            {updateRecipeMutation.isPending ? '保存中...' : '編集して保存'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/recipes')}
            disabled={updateRecipeMutation.isPending}
            style={{
              padding: '0.75rem 1.5rem',
              cursor: updateRecipeMutation.isPending ? 'not-allowed' : 'pointer',
              border: '1px solid #6c757d',
              borderRadius: '4px',
              backgroundColor: 'white',
              color: '#495057',
              fontSize: '1rem',
            }}
          >
            レシピ一覧へ戻る
          </button>
        </div>
      </form>
    </div>
  );
}
