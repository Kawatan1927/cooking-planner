import { APIGatewayProxyResultV2 } from 'aws-lambda';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' } as const;

type ErrorDetails = unknown;

export const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

export const errorResponse = (
  statusCode: number,
  code: string,
  message: string,
  details: ErrorDetails = null
): APIGatewayProxyResultV2 =>
  jsonResponse(statusCode, {
    error: {
      code,
      message,
      details,
    },
  });

export const badRequest = (message: string, code = 'BAD_REQUEST'): APIGatewayProxyResultV2 =>
  errorResponse(400, code, message);

export const unauthorized = (message: string, code = 'UNAUTHORIZED'): APIGatewayProxyResultV2 =>
  errorResponse(401, code, message);

export const notFound = (message: string, code = 'NOT_FOUND'): APIGatewayProxyResultV2 =>
  errorResponse(404, code, message);

export const internalServerError = (
  message: string,
  code = 'INTERNAL_SERVER_ERROR'
): APIGatewayProxyResultV2 => errorResponse(500, code, message);
