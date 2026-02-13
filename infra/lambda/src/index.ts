import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { getRecipes } from './recipes';

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

    // Recipes endpoints
    if (rawPath === '/recipes' && httpMethod === 'GET') {
      return getRecipes(event);
    }

    // TODO: Add routing logic for other endpoints
    // - POST /recipes
    // - GET /recipes/{recipeId}
    // - PUT /recipes/{recipeId}
    // - DELETE /recipes/{recipeId}
    // - /menus
    // - /shopping-list

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
