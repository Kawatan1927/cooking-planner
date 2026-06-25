import { Hono } from 'hono';
import { adapt } from '../shared/adapt';
import { getRecipes, createRecipe, getRecipeById, updateRecipe } from '../recipes';

/**
 * /recipes 配下のルーター。
 * @see docs/04-api-design.md §2
 */
const recipes = new Hono();

recipes.get('/', adapt(getRecipes));
recipes.post('/', adapt(createRecipe));
recipes.get('/:recipeId', adapt(getRecipeById));
recipes.put('/:recipeId', adapt(updateRecipe));

export default recipes;
