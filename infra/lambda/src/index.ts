import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getRecipes, createRecipe, getRecipeById, updateRecipe } from './recipes';
import { getMenus, createMenu, updateMenu, deleteMenu } from './menus';
import { getShoppingList } from './shoppingList';

/**
 * Main Lambda handler for Cooking Planner API
 * Routes requests based on path and HTTP method
 */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  const { requestContext, rawPath } = event;
  const httpMethod = requestContext.http.method;

  console.log(`[${httpMethod}] ${rawPath}`);

  try {
    // Health check endpoint (no authentication required)
    if (rawPath === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ok',
          time: new Date().toISOString(),
        }),
      };
    }

    // GET /recipes/{recipeId}
    const recipeByIdMatch = rawPath.match(/^\/recipes\/([^/]+)$/);
    if (recipeByIdMatch && httpMethod === 'GET') {
      return getRecipeById({
        ...event,
        pathParameters: { recipeId: recipeByIdMatch[1] },
      } as APIGatewayProxyEventV2WithJWTAuthorizer);
    }

    if (recipeByIdMatch && httpMethod === 'PUT') {
      return updateRecipe({
        ...event,
        pathParameters: { recipeId: recipeByIdMatch[1] },
      } as APIGatewayProxyEventV2WithJWTAuthorizer);
    }

    // Recipes endpoints
    if (rawPath === '/recipes' && httpMethod === 'GET') {
      return getRecipes(event);
    }

    if (rawPath === '/recipes' && httpMethod === 'POST') {
      return createRecipe(event);
    }

    // TODO: Add routing logic for other endpoints
    // - DELETE /recipes/{recipeId}
    // - /shopping-list

    // Menus endpoints
    const menuByIdMatch = rawPath.match(/^\/menus\/([^/]+)$/);
    if (menuByIdMatch && httpMethod === 'PUT') {
      return updateMenu({
        ...event,
        pathParameters: { menuId: menuByIdMatch[1] },
      } as APIGatewayProxyEventV2WithJWTAuthorizer);
    }

    if (menuByIdMatch && httpMethod === 'DELETE') {
      return deleteMenu({
        ...event,
        pathParameters: { menuId: menuByIdMatch[1] },
      } as APIGatewayProxyEventV2WithJWTAuthorizer);
    }

    if (rawPath === '/menus' && httpMethod === 'GET') {
      return getMenus(event);
    }

    if (rawPath === '/menus' && httpMethod === 'POST') {
      return createMenu(event);
    }

    // Shopping list endpoints
    if (rawPath === '/shopping-list' && httpMethod === 'GET') {
      return getShoppingList(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
          details: null,
        },
      }),
    };
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          details: null,
        },
      }),
    };
  }
};
