import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * recipes テーブル。API 上の recipeId は本テーブルの id（UUID）。
 * @see docs/03-domain-and-data-model.md §3
 */
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name').notNull(),
    sourceBook: varchar('source_book'),
    sourcePage: integer('source_page'),
    baseServings: integer('base_servings').notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [index('recipes_user_id_idx').on(table.userId)]
);

/**
 * recipe_ingredients テーブル。user_id は持たず recipe_id 経由で継承。
 * quantity_value / quantity_text はどちらか一方のみ設定（CHECK 制約）。
 * @see docs/03-domain-and-data-model.md §4
 */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientName: varchar('ingredient_name').notNull(),
    quantityValue: numeric('quantity_value'),
    quantityText: varchar('quantity_text'),
    unit: varchar('unit').notNull(),
    note: varchar('note'),
  },
  table => [
    index('recipe_ingredients_recipe_id_idx').on(table.recipeId),
    check(
      'recipe_ingredients_quantity_check',
      sql`(${table.quantityValue} IS NULL) <> (${table.quantityText} IS NULL)`
    ),
  ]
);

/**
 * menus テーブル。API 上の menuId は本テーブルの id（UUID）。
 * meal_type は CHECK 制約で許可値に限定。
 * @see docs/03-domain-and-data-model.md §5
 */
export const menus = pgTable(
  'menus',
  {
    id: uuid('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    mealType: varchar('meal_type').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id),
    servings: numeric('servings').notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [
    index('menus_user_id_date_idx').on(table.userId, table.date),
    check(
      'menus_meal_type_check',
      sql`${table.mealType} IN ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER')`
    ),
  ]
);
