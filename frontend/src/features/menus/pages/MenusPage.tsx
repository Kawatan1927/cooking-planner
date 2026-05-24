import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRecipes } from '@/features/recipes';
import type { MenuInput, MenuItem } from '../types';
import { useCreateMenu, useDeleteMenu, useUpdateMenu, useMenus } from '../hooks';

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;
type DisplayMealType = (typeof MEAL_TYPES)[number];

const mealTypeLabels: Record<DisplayMealType, string> = {
  BREAKFAST: '朝',
  LUNCH: '昼',
  DINNER: '夜',
};

const containerStyle = {
  padding: '2rem',
  maxWidth: '1200px',
  margin: '0 auto',
};

const inputStyle = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '0.95rem',
  boxSizing: 'border-box' as const,
};

const toDateInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const addDays = (date: string, days: number): string => {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return toDateInputValue(base);
};

const buildDateRange = (startDate: string, days: number): string[] =>
  Array.from({ length: days }, (_, index) => addDays(startDate, index));

interface MenuItemEditorProps {
  item: MenuItem;
  recipeName: string;
  recipeOptions: Array<{ recipeId: string; name: string }>;
  onDelete: (menuId: string) => Promise<void>;
  disabled?: boolean;
}

function MenuItemEditor({
  item,
  recipeName,
  recipeOptions,
  onDelete,
  disabled = false,
}: MenuItemEditorProps) {
  const updateMutation = useUpdateMenu({ menuId: item.menuId });
  const [editState, setEditState] = useState<{ recipeId: string; servings: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recipeId = editState?.recipeId ?? item.recipeId;
  const servings = editState?.servings ?? String(item.servings);

  const isUpdating = updateMutation.isPending;

  const handleRecipeIdChange = (value: string) => {
    setEditState(prev => ({ recipeId: value, servings: prev?.servings ?? String(item.servings) }));
  };

  const handleServingsChange = (value: string) => {
    setEditState(prev => ({ recipeId: prev?.recipeId ?? item.recipeId, servings: value }));
  };

  const handleUpdate = async () => {
    const normalizedRecipeId = recipeId.trim();
    const normalizedServings = Number(servings);

    if (!normalizedRecipeId) {
      setErrorMessage('レシピIDを入力してください。');
      return;
    }

    if (!Number.isFinite(normalizedServings) || normalizedServings <= 0) {
      setErrorMessage('人数は0より大きい値で入力してください。');
      return;
    }

    const payload: MenuInput = {
      date: item.date,
      mealType: item.mealType,
      recipeId: normalizedRecipeId,
      servings: normalizedServings,
    };

    try {
      await updateMutation.mutateAsync(payload);
      setEditState(null);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '更新に失敗しました。');
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(item.menuId);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '削除に失敗しました。');
    }
  };

  return (
    <li
      style={{
        border: '1px solid #dee2e6',
        borderRadius: '6px',
        padding: '0.75rem',
        backgroundColor: '#fff',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <div style={{ color: '#495057', fontSize: '0.9rem' }}>レシピ名: {recipeName}</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1fr) minmax(100px, 140px) auto auto',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        {recipeOptions.length > 0 ? (
          <select
            value={recipeId}
            onChange={event => handleRecipeIdChange(event.target.value)}
            disabled={disabled || isUpdating}
            style={inputStyle}
            aria-label="レシピ"
          >
            <option value="">レシピを選択</option>
            {recipeOptions.map(option => (
              <option key={option.recipeId} value={option.recipeId}>
                {option.name} ({option.recipeId})
              </option>
            ))}
          </select>
        ) : (
          <input
            value={recipeId}
            onChange={event => handleRecipeIdChange(event.target.value)}
            placeholder="recipeId"
            disabled={disabled || isUpdating}
            style={inputStyle}
            aria-label="レシピID"
          />
        )}
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={servings}
          onChange={event => handleServingsChange(event.target.value)}
          disabled={disabled || isUpdating}
          style={inputStyle}
          aria-label="人数"
        />
        <button
          type="button"
          onClick={handleUpdate}
          disabled={disabled || isUpdating}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            border: '1px solid #0d6efd',
            backgroundColor: '#0d6efd',
            color: '#fff',
            cursor: disabled || isUpdating ? 'not-allowed' : 'pointer',
          }}
        >
          {isUpdating ? '更新中...' : '更新'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={disabled || isUpdating}
          style={{
            padding: '0.5rem 0.75rem',
            borderRadius: '4px',
            border: '1px solid #dc3545',
            backgroundColor: '#fff',
            color: '#dc3545',
            cursor: disabled || isUpdating ? 'not-allowed' : 'pointer',
          }}
        >
          削除
        </button>
      </div>
      {errorMessage && <p style={{ margin: 0, color: '#721c24' }}>{errorMessage}</p>}
    </li>
  );
}

export function MenusPage() {
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [displayDays, setDisplayDays] = useState('7');
  const [newMenuDate, setNewMenuDate] = useState(() => toDateInputValue(new Date()));
  const [newMenuMealType, setNewMenuMealType] = useState<DisplayMealType>('DINNER');
  const [newMenuRecipeId, setNewMenuRecipeId] = useState('');
  const [newMenuServings, setNewMenuServings] = useState('1');
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);

  const parsedDisplayDays = parseInt(displayDays, 10);
  const normalizedDisplayDays = Math.min(
    30,
    Math.max(1, Number.isFinite(parsedDisplayDays) ? parsedDisplayDays : 7)
  );
  const endDate = useMemo(
    () => (startDate ? addDays(startDate, Math.max(normalizedDisplayDays - 1, 0)) : ''),
    [normalizedDisplayDays, startDate]
  );

  const menusQuery = useMenus({ from: startDate, to: endDate, enabled: !!startDate });
  const recipesQuery = useRecipes();
  const createMenuMutation = useCreateMenu();
  const deleteMenuMutation = useDeleteMenu();

  const recipeOptions = useMemo(
    () =>
      (recipesQuery.data ?? []).map(recipe => ({
        recipeId: recipe.recipeId,
        name: recipe.name,
      })),
    [recipesQuery.data]
  );

  const recipeNameMap = useMemo(() => {
    const entries = recipeOptions.map(option => [option.recipeId, option.name] as const);
    return new Map<string, string>(entries);
  }, [recipeOptions]);

  const groupedMenus = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menusQuery.data?.items ?? []) {
      const mealTypeKey = MEAL_TYPES.includes(item.mealType as DisplayMealType)
        ? item.mealType
        : 'OTHER';
      const key = `${item.date}:${mealTypeKey}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [menusQuery.data?.items]);

  const visibleDates = useMemo(
    () => buildDateRange(startDate, normalizedDisplayDays),
    [normalizedDisplayDays, startDate]
  );

  const handleCreateMenu = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedRecipeId = newMenuRecipeId.trim();
    const normalizedServings = Number(newMenuServings);

    if (!normalizedRecipeId) {
      setCreateErrorMessage('レシピIDを入力してください。');
      return;
    }

    if (!Number.isFinite(normalizedServings) || normalizedServings <= 0) {
      setCreateErrorMessage('人数は0より大きい値で入力してください。');
      return;
    }

    try {
      await createMenuMutation.mutateAsync({
        date: newMenuDate,
        mealType: newMenuMealType,
        recipeId: normalizedRecipeId,
        servings: normalizedServings,
      });
      setCreateErrorMessage(null);
      setNewMenuRecipeId('');
      setNewMenuServings('1');
    } catch (error) {
      setCreateErrorMessage(error instanceof Error ? error.message : '献立の追加に失敗しました。');
    }
  };

  const handleDeleteMenu = async (menuId: string): Promise<void> => {
    await deleteMenuMutation.mutateAsync(menuId);
  };

  const hasMenus = (menusQuery.data?.items.length ?? 0) > 0;

  return (
    <div style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>献立一覧／編集</h1>

      <section
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          backgroundColor: '#f8f9fa',
        }}
      >
        <h2 style={{ marginTop: 0 }}>表示条件</h2>
        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'minmax(180px, 240px) minmax(120px, 180px)',
            alignItems: 'end',
          }}
        >
          <label>
            <span>開始日</span>
            <input
              type="date"
              value={startDate}
              onChange={event => {
                if (event.target.value) setStartDate(event.target.value);
              }}
              style={inputStyle}
            />
          </label>
          <label>
            <span>表示日数</span>
            <input
              type="number"
              min="1"
              max="30"
              step="1"
              value={displayDays}
              onChange={event => setDisplayDays(event.target.value)}
              onBlur={() => setDisplayDays(String(normalizedDisplayDays))}
              style={inputStyle}
            />
          </label>
        </div>
        <p style={{ marginBottom: 0, color: '#495057' }}>
          API 取得期間: {startDate} 〜 {endDate}
        </p>
      </section>

      <section
        style={{
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ marginTop: 0 }}>献立を追加</h2>
        <form
          onSubmit={handleCreateMenu}
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns:
              'minmax(150px, 200px) minmax(120px, 160px) minmax(220px, 1fr) minmax(100px, 140px) auto',
            alignItems: 'end',
          }}
        >
          <label>
            <span>日付</span>
            <input
              type="date"
              value={newMenuDate}
              onChange={event => setNewMenuDate(event.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <label>
            <span>食事区分</span>
            <select
              value={newMenuMealType}
              onChange={event => setNewMenuMealType(event.target.value as DisplayMealType)}
              style={inputStyle}
            >
              {MEAL_TYPES.map(mealType => (
                <option key={mealType} value={mealType}>
                  {mealTypeLabels[mealType]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>レシピ</span>
            {recipeOptions.length > 0 ? (
              <select
                value={newMenuRecipeId}
                onChange={event => setNewMenuRecipeId(event.target.value)}
                style={inputStyle}
                required
              >
                <option value="">レシピを選択</option>
                {recipeOptions.map(option => (
                  <option key={option.recipeId} value={option.recipeId}>
                    {option.name} ({option.recipeId})
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={newMenuRecipeId}
                onChange={event => setNewMenuRecipeId(event.target.value)}
                placeholder="recipeId"
                style={inputStyle}
                required
              />
            )}
          </label>
          <label>
            <span>人数</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={newMenuServings}
              onChange={event => setNewMenuServings(event.target.value)}
              style={inputStyle}
              required
            />
          </label>
          <button
            type="submit"
            disabled={createMenuMutation.isPending}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#28a745',
              color: '#fff',
              cursor: createMenuMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {createMenuMutation.isPending ? '追加中...' : '追加'}
          </button>
        </form>
        {createErrorMessage && (
          <p style={{ color: '#721c24', marginBottom: 0 }}>{createErrorMessage}</p>
        )}
      </section>

      {menusQuery.isLoading && <p>献立を読み込み中...</p>}

      {menusQuery.error && (
        <div
          style={{
            padding: '1rem',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: 0 }}>献立の取得に失敗しました。</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
            {menusQuery.error.message}
          </p>
        </div>
      )}

      {!menusQuery.isLoading && !menusQuery.error && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {!hasMenus && (
            <div
              style={{
                padding: '1rem',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                backgroundColor: '#fff',
                color: '#495057',
              }}
            >
              対象期間 ({startDate} 〜 {endDate}) に献立がありません。
            </div>
          )}
          {visibleDates.map(date => (
            <section
              key={date}
              style={{
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: '#fff',
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>{date}</h2>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {MEAL_TYPES.map(mealType => {
                  const key = `${date}:${mealType}`;
                  const items = groupedMenus.get(key) ?? [];

                  return (
                    <div
                      key={mealType}
                      style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        backgroundColor: '#f8f9fa',
                      }}
                    >
                      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                        {mealTypeLabels[mealType]}
                      </h3>
                      {items.length === 0 ? (
                        <p style={{ margin: 0, color: '#6c757d' }}>登録済み献立はありません。</p>
                      ) : (
                        <ul
                          style={{
                            listStyle: 'none',
                            margin: 0,
                            padding: 0,
                            display: 'grid',
                            gap: '0.5rem',
                          }}
                        >
                          {items.map(item => (
                            <MenuItemEditor
                              key={item.menuId}
                              item={item}
                              recipeName={
                                recipeNameMap.get(item.recipeId) ??
                                `未登録レシピ (${item.recipeId})`
                              }
                              recipeOptions={recipeOptions}
                              onDelete={handleDeleteMenu}
                              disabled={deleteMenuMutation.isPending}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const otherItems = groupedMenus.get(`${date}:OTHER`) ?? [];
                  if (otherItems.length === 0) return null;
                  return (
                    <div
                      key="OTHER"
                      style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '6px',
                        padding: '0.75rem',
                        backgroundColor: '#fff3cd',
                      }}
                    >
                      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>その他</h3>
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: 0,
                          padding: 0,
                          display: 'grid',
                          gap: '0.5rem',
                        }}
                      >
                        {otherItems.map(item => (
                          <MenuItemEditor
                            key={item.menuId}
                            item={item}
                            recipeName={
                              recipeNameMap.get(item.recipeId) ?? `未登録レシピ (${item.recipeId})`
                            }
                            recipeOptions={recipeOptions}
                            onDelete={handleDeleteMenu}
                            disabled={deleteMenuMutation.isPending}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
