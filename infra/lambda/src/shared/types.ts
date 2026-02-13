/**
 * Common types used across Lambda functions
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

export interface Recipe {
  recipeId: string;
  userId: string;
  name: string;
  sourceBook?: string;
  sourcePage?: number;
  baseServings: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeResponse {
  recipeId: string;
  name: string;
  sourceBook: string | null;
  sourcePage: number | null;
  baseServings: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  userId: string;
  recipeId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface Menu {
  menuId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  recipeId: string;
  servings: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended type for API Gateway event with JWT authorizer
 * This type includes the authorizer context which is present when using JWT authorizer
 */
export interface APIGatewayProxyEventV2WithAuthorizer {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  headers?: { [name: string]: string | undefined };
  queryStringParameters?: { [name: string]: string | undefined };
  pathParameters?: { [name: string]: string | undefined };
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
    authorizer?: {
      jwt?: {
        claims?: {
          sub?: string;
          email?: string;
          [key: string]: unknown;
        };
      };
    };
  };
  body?: string;
  isBase64Encoded: boolean;
}
