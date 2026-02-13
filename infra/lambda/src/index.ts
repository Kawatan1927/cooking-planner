import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handlePostRecipe } from './recipes/post-recipe';

/**
 * Main Lambda handler for Cooking Planner API
 * Routes requests based on path and HTTP method
 */
export const handler = async (
  event: APIGatewayProxyEventV2
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

    // POST /recipes - Create a new recipe
    if (rawPath === '/recipes' && httpMethod === 'POST') {
      return handlePostRecipe(event);
    }

    // GET /recipes - Temporary placeholder response merged from main branch
    if (rawPath === '/recipes' && httpMethod === 'GET') {
      return {
        statusCode: 501,
        body: JSON.stringify({ message: 'GET /recipes is not implemented yet' }),
      };
    }

    // TODO: Add routing logic for other endpoints
    // - GET /recipes/{recipeId}
    // - PUT /recipes/{recipeId}
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
