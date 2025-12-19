/**
 * API クライアント共通処理
 *
 * VITE_API_BASE_URL と Authorization ヘッダを扱う共通 apiFetch 関数を提供します。
 */

/**
 * API エラーレスポンスの型定義
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * API エラークラス
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * apiFetch のオプション
 */
export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
}

/**
 * API ベース URL を取得
 */
function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL が設定されていません');
  }
  return baseUrl;
}

/**
 * 共通 API fetch 関数
 *
 * @param path - API エンドポイントのパス（例: '/recipes', '/menus'）
 * @param options - fetch オプション（token, method, body など）
 * @returns Promise<T> - レスポンスボディ（JSON パース済み）
 * @throws ApiError - API エラーが発生した場合
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, token, headers = {}, ...restOptions } = options;

  // ベース URL を取得
  const baseUrl = getApiBaseUrl();

  // URL を構築（パスが / で始まらない場合は追加）
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  // ヘッダを構築
  const requestHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  // Authorization ヘッダを追加（token が提供されている場合）
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // body がある場合は JSON.stringify して Content-Type を設定
  let requestBody: string | undefined;
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  // fetch を実行
  const response = await fetch(url, {
    ...restOptions,
    headers: requestHeaders,
    body: requestBody,
  });

  // レスポンスを処理
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');

  // ステータスコードが 2xx の場合
  if (response.ok) {
    // レスポンスボディがある場合は JSON パース
    if (hasJsonContent) {
      return (await response.json()) as T;
    }
    // レスポンスボディがない場合（204 No Content など）
    return undefined as T;
  }

  // エラーレスポンスを処理
  if (hasJsonContent) {
    const errorData = (await response.json()) as ApiErrorResponse;
    throw new ApiError(
      response.status,
      errorData.error.code,
      errorData.error.message,
      errorData.error.details
    );
  }

  // JSON でないエラーレスポンスの場合
  const errorText = await response.text();
  throw new ApiError(response.status, 'UNKNOWN_ERROR', errorText || response.statusText);
}
