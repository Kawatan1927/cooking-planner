# GET /recipes Implementation

## Overview
This implementation handles the `GET /recipes` endpoint as specified in `docs/04-api-design.md`.

## Implementation Details

### Files Created
- `infra/lambda/src/recipes/getRecipes.ts` - Main handler for GET /recipes
- `infra/lambda/src/recipes/index.ts` - Export module for recipes handlers

### Files Modified
- `infra/lambda/src/index.ts` - Added routing for GET /recipes endpoint

## How It Works

1. **Authentication**: Uses `APIGatewayProxyEventV2WithJWTAuthorizer` type to handle JWT authentication from Cognito
2. **User Identification**: Extracts `userId` from `event.requestContext.authorizer.jwt.claims.sub`
3. **Data Retrieval**: Queries DynamoDB `Recipes` table with `userId` as partition key
4. **Response Formatting**: Maps DynamoDB items to match API specification format
5. **Error Handling**: Returns appropriate HTTP status codes and error messages

## Response Format

Success (200):
```json
[
  {
    "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "name": "鶏の照り焼き",
    "sourceBook": "週末の定番おかず",
    "sourcePage": 34,
    "baseServings": 2,
    "createdAt": "2025-11-21T12:00:00.000Z",
    "updatedAt": "2025-11-21T12:00:00.000Z"
  }
]
```

Error responses follow the format specified in `docs/04-api-design.md`:
- 401: Unauthorized (invalid/missing JWT)
- 500: Internal Server Error

## Security Features

- **Privacy Protection**: User IDs are truncated in logs (first 8 chars only)
- **Nullish Coalescing**: Uses `??` operator to properly handle falsy values
- **User Isolation**: Queries are scoped to the authenticated user's data only

## Testing

To test this endpoint once deployed:

1. **Prerequisites**:
   - DynamoDB `Recipes` table must be created with PK=userId, SK=recipeId
   - API Gateway with JWT Authorizer configured
   - Cognito User Pool with registered user

2. **Test Request**:
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://your-api-domain/recipes
```

3. **Expected Behavior**:
   - If no recipes exist for the user: Returns empty array `[]`
   - If recipes exist: Returns array of recipe objects
   - If JWT is invalid: Returns 401 error

## Environment Variables Required

The Lambda function requires these environment variables (set via CDK):
- `RECIPES_TABLE_NAME`: Name of the DynamoDB Recipes table

## Next Steps

Future endpoints to implement:
- POST /recipes - Create new recipe
- GET /recipes/{recipeId} - Get recipe details
- PUT /recipes/{recipeId} - Update recipe
- DELETE /recipes/{recipeId} - Delete recipe
