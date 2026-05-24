import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingListItems } from '../components';
import { useShoppingList } from '../hooks';

interface ShoppingListRange {
  from: string;
  to: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toDateInputValue = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const isValidDateInput = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
};

const getInitialRange = (
  searchParams: URLSearchParams
): {
  formRange: ShoppingListRange;
  submittedRange: ShoppingListRange | null;
} => {
  const today = toDateInputValue(new Date());
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const normalizedFrom = from && isValidDateInput(from) ? from : today;
  const normalizedTo = to && isValidDateInput(to) ? to : normalizedFrom;

  if (from && to && isValidDateInput(from) && isValidDateInput(to) && from <= to) {
    return {
      formRange: { from, to },
      submittedRange: { from, to },
    };
  }

  return {
    formRange: {
      from: normalizedFrom,
      to: normalizedTo >= normalizedFrom ? normalizedTo : normalizedFrom,
    },
    submittedRange: null,
  };
};

const formatRangeLabel = (range: ShoppingListRange): string => `${range.from} 〜 ${range.to}`;

export function ShoppingListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRange = getInitialRange(searchParams);

  const [from, setFrom] = useState(initialRange.formRange.from);
  const [to, setTo] = useState(initialRange.formRange.to);
  const [submittedRange, setSubmittedRange] = useState<ShoppingListRange | null>(
    initialRange.submittedRange
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const shoppingListQuery = useShoppingList({
    from: submittedRange?.from,
    to: submittedRange?.to,
    enabled: !!submittedRange,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!from || !to) {
      setFormError('開始日と終了日を入力してください。');
      return;
    }

    if (!isValidDateInput(from) || !isValidDateInput(to)) {
      setFormError('日付は YYYY-MM-DD 形式で入力してください。');
      return;
    }

    if (from > to) {
      setFormError('終了日は開始日以降の日付を指定してください。');
      return;
    }

    setFormError(null);
    setCheckedItems({});
    setSubmittedRange({ from, to });
    setSearchParams({ from, to });
  };

  const handleToggleItem = (itemKey: string) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  const isLoading = shoppingListQuery.isLoading || shoppingListQuery.isFetching;
  const items = shoppingListQuery.data?.items ?? [];
  const hasSubmitted = submittedRange !== null;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.title}>買い物リスト</h1>
          <p style={styles.description}>
            期間を指定して献立から必要な材料を集計し、買い物中にチェックできます。
          </p>
        </div>
      </div>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>期間指定</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>開始日</span>
            <input
              type="date"
              value={from}
              onChange={event => setFrom(event.target.value)}
              style={styles.input}
              max={to || undefined}
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.fieldLabel}>終了日</span>
            <input
              type="date"
              value={to}
              onChange={event => setTo(event.target.value)}
              style={styles.input}
              min={from || undefined}
              required
            />
          </label>

          <button type="submit" style={styles.submitButton} disabled={isLoading}>
            {isLoading ? '生成中...' : 'リストを生成'}
          </button>
        </form>

        {formError && (
          <p role="alert" style={styles.formError}>
            {formError}
          </p>
        )}
      </section>

      {!hasSubmitted && (
        <section style={styles.messageCard}>
          <p style={styles.messageTitle}>期間を指定して買い物リストを生成してください。</p>
          <p style={styles.messageText}>
            指定した期間の献立に含まれる材料を、材料名ごとに合算して表示します。
          </p>
        </section>
      )}

      {submittedRange && isLoading && (
        <section style={styles.messageCard}>
          <p style={styles.messageTitle}>買い物リストを読み込み中です...</p>
          <p style={styles.messageText}>{formatRangeLabel(submittedRange)}</p>
        </section>
      )}

      {submittedRange && shoppingListQuery.error && !isLoading && (
        <section style={styles.errorCard}>
          <p style={styles.messageTitle}>買い物リストの取得に失敗しました。</p>
          <p style={styles.messageText}>{shoppingListQuery.error.message}</p>
        </section>
      )}

      {submittedRange && !shoppingListQuery.error && !isLoading && items.length === 0 && (
        <section style={styles.messageCard}>
          <p style={styles.messageTitle}>対象期間の買い物項目はありません。</p>
          <p style={styles.messageText}>
            {formatRangeLabel(submittedRange)} に献立がないか、材料の登録がまだありません。
          </p>
        </section>
      )}

      {hasSubmitted &&
        !shoppingListQuery.error &&
        !isLoading &&
        items.length > 0 &&
        submittedRange && (
          <>
            <section style={styles.summaryCard}>
              <p style={styles.summaryLabel}>表示期間</p>
              <p style={styles.summaryValue}>{formatRangeLabel(submittedRange)}</p>
            </section>
            <ShoppingListItems
              items={items}
              checkedItems={checkedItems}
              onToggleItem={handleToggleItem}
            />
          </>
        )}
    </div>
  );
}

const styles = {
  page: {
    display: 'grid',
    gap: '1rem',
    padding: '0.5rem 0 1.5rem',
    maxWidth: '720px',
    margin: '0 auto',
  },
  pageHeader: {
    paddingTop: '0.5rem',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
  },
  description: {
    margin: '0.5rem 0 0',
    color: '#4b5563',
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
  cardTitle: {
    margin: 0,
    fontSize: '1.1rem',
  },
  form: {
    display: 'grid',
    gap: '0.75rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    alignItems: 'end',
  },
  field: {
    display: 'grid',
    gap: '0.5rem',
  },
  fieldLabel: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#1f2937',
  },
  input: {
    width: '100%',
    minHeight: '44px',
    padding: '0.75rem',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
    backgroundColor: '#fff',
  },
  submitButton: {
    minHeight: '44px',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  formError: {
    margin: 0,
    color: '#b91c1c',
    fontSize: '0.95rem',
  },
  messageCard: {
    padding: '1rem',
    borderRadius: '16px',
    border: '1px solid #dbeafe',
    backgroundColor: '#eff6ff',
  },
  errorCard: {
    padding: '1rem',
    borderRadius: '16px',
    border: '1px solid #fecaca',
    backgroundColor: '#fef2f2',
  },
  messageTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
  },
  messageText: {
    margin: '0.5rem 0 0',
    color: '#4b5563',
    lineHeight: 1.6,
  },
  summaryCard: {
    padding: '0.875rem 1rem',
    borderRadius: '12px',
    border: '1px solid #bfdbfe',
    backgroundColor: '#f8fbff',
  },
  summaryLabel: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#2563eb',
    fontWeight: 700,
  },
  summaryValue: {
    margin: '0.35rem 0 0',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111827',
  },
} as const;
