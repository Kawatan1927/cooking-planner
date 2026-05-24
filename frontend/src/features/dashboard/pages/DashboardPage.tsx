import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMenus } from '@/features/menus';
import { useRecipes } from '@/features/recipes';
import type { MealType, MenuItem } from '@/features/menus';

const MEAL_SECTIONS = [
  { mealType: 'BREAKFAST', label: '朝' },
  { mealType: 'LUNCH', label: '昼' },
  { mealType: 'DINNER', label: '夜' },
] as const satisfies ReadonlyArray<{ mealType: MealType; label: string }>;

const toDateInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const formatDisplayDate = (date: Date): string =>
  new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);

const formatServings = (servings: number): string =>
  `${servings.toLocaleString('ja-JP', { maximumFractionDigits: 1 })}人分`;

const buildShoppingListHref = (date: string): string => {
  const searchParams = new URLSearchParams({ from: date, to: date });
  return `/shopping-list?${searchParams.toString()}`;
};

const getRecipeLabel = (menu: MenuItem, recipeNameMap: Map<string, string>): string =>
  recipeNameMap.get(menu.recipeId) ?? `未登録レシピ (${menu.recipeId})`;

export function DashboardPage() {
  const [{ today, todayLabel }] = useState(() => {
    const now = new Date();
    return {
      today: toDateInputValue(now),
      todayLabel: formatDisplayDate(now),
    };
  });

  const menusQuery = useMenus({ from: today, to: today });
  const recipesQuery = useRecipes();

  const recipeNameMap = useMemo(
    () => new Map((recipesQuery.data ?? []).map(recipe => [recipe.recipeId, recipe.name] as const)),
    [recipesQuery.data]
  );

  const menusByMeal = useMemo(() => {
    const initialMap = new Map<MealType, MenuItem[]>(
      MEAL_SECTIONS.map(({ mealType }) => [mealType, []] as const)
    );

    for (const item of menusQuery.data?.items ?? []) {
      if (!initialMap.has(item.mealType)) {
        continue;
      }
      initialMap.get(item.mealType)?.push(item);
    }

    return initialMap;
  }, [menusQuery.data?.items]);

  const isLoading = menusQuery.isLoading || recipesQuery.isLoading;
  const error = menusQuery.error ?? recipesQuery.error;
  const hasAnyMenu = (menusQuery.data?.items.length ?? 0) > 0;

  return (
    <div style={styles.page}>
      <section style={styles.heroCard}>
        <div>
          <p style={styles.eyebrow}>ダッシュボード</p>
          <h1 style={styles.title}>今日の献立</h1>
          <p style={styles.dateText}>{todayLabel}</p>
          <p style={styles.description}>
            今日の献立と買い物リストへの入口です。必要な操作だけをすぐ始められます。
          </p>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>当日の概要</h2>
            <p style={styles.sectionDescription}>{today} の朝・昼・夜を確認できます。</p>
          </div>
        </div>

        {isLoading && (
          <div style={styles.infoCard}>
            <p style={styles.messageTitle}>今日の献立を読み込み中です...</p>
            <p style={styles.messageText}>献立とレシピ情報を取得しています。</p>
          </div>
        )}

        {error && !isLoading && (
          <div style={styles.errorCard}>
            <p style={styles.messageTitle}>今日の献立を取得できませんでした。</p>
            <p style={styles.messageText}>{error.message}</p>
          </div>
        )}

        {!isLoading && !error && !hasAnyMenu && (
          <div style={styles.infoCard}>
            <p style={styles.messageTitle}>今日はまだ献立が登録されていません。</p>
            <p style={styles.messageText}>
              朝・昼・夜の予定を追加すると、ここに概要が表示されます。
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <div style={styles.mealGrid}>
            {MEAL_SECTIONS.map(({ mealType, label }) => {
              const items = menusByMeal.get(mealType) ?? [];

              return (
                <section key={mealType} style={styles.mealCard}>
                  <h3 style={styles.mealTitle}>{label}</h3>
                  {items.length === 0 ? (
                    <p style={styles.emptyText}>未設定です。</p>
                  ) : (
                    <ul style={styles.menuList}>
                      {items.map(item => (
                        <li key={item.menuId} style={styles.menuListItem}>
                          <span style={styles.menuName}>{getRecipeLabel(item, recipeNameMap)}</span>
                          <span style={styles.menuMeta}>{formatServings(item.servings)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>よく使う操作</h2>
            <p style={styles.sectionDescription}>MVP 範囲の主要機能へそのまま移動できます。</p>
          </div>
        </div>

        <div style={styles.linkGrid}>
          <Link to="/menus" style={{ ...styles.actionCard, ...styles.primaryActionCard }}>
            <span style={styles.actionTitle}>今日の献立を編集</span>
            <span style={styles.actionDescription}>
              献立一覧／編集画面で今日の朝・昼・夜を更新します。
            </span>
          </Link>

          <Link to={buildShoppingListHref(today)} style={styles.actionCard}>
            <span style={styles.actionTitle}>今日の買い物リストを見る</span>
            <span style={styles.actionDescription}>
              {today} を対象に買い物リスト画面へ移動します。
            </span>
          </Link>

          <Link to="/recipes/new" style={styles.actionCard}>
            <span style={styles.actionTitle}>新しいレシピを登録</span>
            <span style={styles.actionDescription}>
              レシピ登録画面を開いて新しい料理を追加します。
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '1rem',
    padding: '0.5rem 0 1.5rem',
  },
  heroCard: {
    padding: '1.25rem',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
    border: '1px solid #bfdbfe',
    boxShadow: '0 8px 24px rgba(37, 99, 235, 0.08)',
  },
  eyebrow: {
    margin: 0,
    color: '#2563eb',
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  title: {
    margin: '0.4rem 0 0',
    fontSize: '2rem',
  },
  dateText: {
    margin: '0.5rem 0 0',
    color: '#1d4ed8',
    fontSize: '1rem',
    fontWeight: 600,
  },
  description: {
    margin: '0.75rem 0 0',
    color: '#475569',
    lineHeight: 1.6,
  },
  card: {
    display: 'grid',
    gap: '1rem',
    padding: '1rem',
    borderRadius: '16px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.2rem',
  },
  sectionDescription: {
    margin: '0.4rem 0 0',
    color: '#64748b',
    lineHeight: 1.6,
  },
  infoCard: {
    padding: '1rem',
    borderRadius: '14px',
    border: '1px solid #dbeafe',
    backgroundColor: '#eff6ff',
  },
  errorCard: {
    padding: '1rem',
    borderRadius: '14px',
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
  },
  messageTitle: {
    margin: 0,
    color: '#111827',
    fontWeight: 700,
  },
  messageText: {
    margin: '0.5rem 0 0',
    color: '#4b5563',
    lineHeight: 1.6,
  },
  mealGrid: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  },
  mealCard: {
    padding: '1rem',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  mealTitle: {
    margin: 0,
    fontSize: '1.1rem',
  },
  emptyText: {
    margin: '0.75rem 0 0',
    color: '#64748b',
  },
  menuList: {
    listStyle: 'none',
    margin: '0.75rem 0 0',
    padding: 0,
    display: 'grid',
    gap: '0.75rem',
  },
  menuListItem: {
    display: 'grid',
    gap: '0.3rem',
  },
  menuName: {
    color: '#111827',
    fontWeight: 600,
  },
  menuMeta: {
    color: '#475569',
    fontSize: '0.9rem',
  },
  linkGrid: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  },
  actionCard: {
    display: 'grid',
    gap: '0.5rem',
    padding: '1rem',
    borderRadius: '14px',
    border: '1px solid #dbeafe',
    backgroundColor: '#f8fbff',
    color: '#111827',
    textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.06)',
  },
  primaryActionCard: {
    backgroundColor: '#eff6ff',
    border: '1px solid #93c5fd',
  },
  actionTitle: {
    fontWeight: 700,
  },
  actionDescription: {
    color: '#475569',
    lineHeight: 1.6,
  },
} as const;
