import { randomUUID } from 'crypto';
import { and, asc, between, eq } from 'drizzle-orm';
import { db } from '../shared/db';
import { menus } from '../shared/schema';
import type { Menu } from '../shared/types';

export interface NewMenuInput {
  userId: string;
  date: string;
  mealType: Menu['mealType'];
  recipeId: string;
  servings: number;
  memo: string | null;
}

const toMenu = (row: typeof menus.$inferSelect): Menu => ({
  menuId: row.id,
  userId: row.userId,
  date: row.date,
  mealType: row.mealType as Menu['mealType'],
  recipeId: row.recipeId,
  servings: Number(row.servings),
  memo: row.memo ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listMenusInRange = async (
  userId: string,
  from: string,
  to: string
): Promise<Menu[]> => {
  const rows = await db
    .select()
    .from(menus)
    .where(and(eq(menus.userId, userId), between(menus.date, from, to)))
    .orderBy(asc(menus.date), asc(menus.mealType));
  return rows.map(toMenu);
};

export const findMenuByIdForUser = async (userId: string, menuId: string): Promise<Menu | null> => {
  const rows = await db
    .select()
    .from(menus)
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)));
  return rows[0] ? toMenu(rows[0]) : null;
};

export const createMenu = async (input: NewMenuInput): Promise<string> => {
  const menuId = randomUUID();
  const now = new Date();
  await db.insert(menus).values({
    id: menuId,
    userId: input.userId,
    date: input.date,
    mealType: input.mealType,
    recipeId: input.recipeId,
    servings: String(input.servings),
    memo: input.memo,
    createdAt: now,
    updatedAt: now,
  });
  return menuId;
};

export const updateMenuForUser = async (
  userId: string,
  menuId: string,
  fields: Omit<NewMenuInput, 'userId'>
): Promise<boolean> => {
  const now = new Date();
  const updated = await db
    .update(menus)
    .set({
      date: fields.date,
      mealType: fields.mealType,
      recipeId: fields.recipeId,
      servings: String(fields.servings),
      memo: fields.memo,
      updatedAt: now,
    })
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)))
    .returning({ id: menus.id });
  return updated.length > 0;
};

export const deleteMenuForUser = async (userId: string, menuId: string): Promise<boolean> => {
  const deleted = await db
    .delete(menus)
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)))
    .returning({ id: menus.id });
  return deleted.length > 0;
};
