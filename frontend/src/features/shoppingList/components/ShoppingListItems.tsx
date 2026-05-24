import type { ShoppingListItem } from '../types';

interface ShoppingListItemsProps {
  items: ShoppingListItem[];
  checkedItems: Record<string, boolean>;
  onToggleItem: (itemKey: string) => void;
}

const getItemKey = (item: ShoppingListItem): string =>
  JSON.stringify([item.ingredientName, item.unit]);

const formatQuantity = (item: ShoppingListItem): string =>
  item.unit ? `${item.totalQuantity}${item.unit}` : String(item.totalQuantity);

export function ShoppingListItems({ items, checkedItems, onToggleItem }: ShoppingListItemsProps) {
  const checkedCount = items.filter(item => checkedItems[getItemKey(item)]).length;

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 style={styles.sectionTitle}>買い物リスト</h2>
          <p style={styles.sectionDescription}>
            {checkedCount} / {items.length} 件チェック済み
          </p>
        </div>
      </div>

      <ul style={styles.list}>
        {items.map(item => {
          const itemKey = getItemKey(item);
          const checked = !!checkedItems[itemKey];

          return (
            <li key={itemKey} style={styles.listItem}>
              <label
                style={{
                  ...styles.itemLabel,
                  ...(checked ? styles.itemLabelChecked : {}),
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleItem(itemKey)}
                  style={styles.checkbox}
                />
                <span style={styles.itemTextGroup}>
                  <span
                    style={{
                      ...styles.ingredientName,
                      ...(checked ? styles.ingredientNameChecked : {}),
                    }}
                  >
                    {item.ingredientName}
                  </span>
                  <span style={styles.quantity}>{formatQuantity(item)}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const styles = {
  section: {
    display: 'grid',
    gap: '1rem',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.125rem',
  },
  sectionDescription: {
    margin: '0.25rem 0 0',
    color: '#4b5563',
    fontSize: '0.95rem',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: '0.75rem',
  },
  listItem: {
    margin: 0,
  },
  itemLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    minHeight: '64px',
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
    cursor: 'pointer',
  },
  itemLabelChecked: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  checkbox: {
    width: '1.35rem',
    height: '1.35rem',
    margin: 0,
    flexShrink: 0,
  },
  itemTextGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    width: '100%',
    flexWrap: 'wrap' as const,
  },
  ingredientName: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111827',
  },
  ingredientNameChecked: {
    textDecoration: 'line-through',
    color: '#4b5563',
  },
  quantity: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#1d4ed8',
  },
} as const;
