import { randomUUID } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../shared/db';
import { recipeIngredients, recipes } from '../shared/schema';
import { mergeQuantity, splitQuantity } from '../shared/quantity';
import type { Recipe, RecipeIngredient } from '../shared/types';

export interface NewRecipeInput {
  userId: string;
  name: string;
  sourceBook: string | null;
  sourcePage: number | null;
  baseServings: number;
  memo: string | null;
}

export interface NewIngredientInput {
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note: string | null;
}

export interface RecipeWithIngredients {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
}

const toRecipe = (row: typeof recipes.$inferSelect): Recipe => ({
  recipeId: row.id,
  userId: row.userId,
  name: row.name,
  sourceBook: row.sourceBook ?? undefined,
  sourcePage: row.sourcePage ?? undefined,
  baseServings: row.baseServings,
  memo: row.memo ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toIngredient = (row: typeof recipeIngredients.$inferSelect): RecipeIngredient => ({
  recipeId: row.recipeId,
  ingredientName: row.ingredientName,
  quantity: mergeQuantity(row.quantityValue, row.quantityText),
  unit: row.unit,
  note: row.note ?? undefined,
});

const toIngredientRows = (recipeId: string, ingredients: NewIngredientInput[]) =>
  ingredients.map(ingredient => {
    const { quantityValue, quantityText } = splitQuantity(ingredient.quantity);
    return {
      id: randomUUID(),
      recipeId,
      ingredientName: ingredient.ingredientName,
      quantityValue,
      quantityText,
      unit: ingredient.unit,
      note: ingredient.note,
    };
  });

export const listRecipesByUser = async (userId: string): Promise<Recipe[]> => {
  const rows = await db.select().from(recipes).where(eq(recipes.userId, userId));
  return rows.map(toRecipe);
};

export const findRecipeWithIngredients = async (
  userId: string,
  recipeId: string
): Promise<RecipeWithIngredients | null> => {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));

  const recipeRow = recipeRows[0];
  if (!recipeRow) {
    return null;
  }

  const ingredientRows = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.ingredientName));

  return {
    recipe: toRecipe(recipeRow),
    ingredients: ingredientRows.map(toIngredient),
  };
};

export const createRecipeWithIngredients = async (
  input: NewRecipeInput,
  ingredients: NewIngredientInput[]
): Promise<string> => {
  const recipeId = randomUUID();
  const now = new Date();

  await db.transaction(async tx => {
    await tx.insert(recipes).values({
      id: recipeId,
      userId: input.userId,
      name: input.name,
      sourceBook: input.sourceBook,
      sourcePage: input.sourcePage,
      baseServings: input.baseServings,
      memo: input.memo,
      createdAt: now,
      updatedAt: now,
    });

    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(toIngredientRows(recipeId, ingredients));
    }
  });

  return recipeId;
};

export const replaceRecipeWithIngredients = async (
  userId: string,
  recipeId: string,
  input: Omit<NewRecipeInput, 'userId'>,
  ingredients: NewIngredientInput[]
): Promise<boolean> => {
  const now = new Date();

  return db.transaction(async tx => {
    const updated = await tx
      .update(recipes)
      .set({
        name: input.name,
        sourceBook: input.sourceBook,
        sourcePage: input.sourcePage,
        baseServings: input.baseServings,
        memo: input.memo,
        updatedAt: now,
      })
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
      .returning({ id: recipes.id });

    if (updated.length === 0) {
      return false;
    }

    await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(toIngredientRows(recipeId, ingredients));
    }

    return true;
  });
};
