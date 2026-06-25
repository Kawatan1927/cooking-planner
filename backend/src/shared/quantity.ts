/**
 * API 入力の quantity（number | string）を DB の
 * quantity_value（数値分量）/ quantity_text（文字列分量）に振り分ける。
 */
export const splitQuantity = (
  quantity: number | string
): { quantityValue: string | null; quantityText: string | null } =>
  typeof quantity === 'number'
    ? { quantityValue: String(quantity), quantityText: null }
    : { quantityValue: null, quantityText: quantity };

/**
 * DB の quantity_value / quantity_text を API の quantity（number | string）に統合する。
 * postgres.js は numeric を文字列で返すため、数値分量は Number() で復元する。
 */
export const mergeQuantity = (
  quantityValue: string | null,
  quantityText: string | null
): number | string => (quantityValue !== null ? Number(quantityValue) : (quantityText ?? ''));
