/**
 * Cognito Hosted UI 連携ユーティリティ
 *
 * Authorization Code Grant フローを使って Cognito Hosted UI 経由の
 * ログインをサポートします。
 *
 * @see docs/05-architecture-notes.md §2.4
 */

/** localStorage に保存する認証トークンのキー */
export const AUTH_TOKEN_STORAGE_KEY = 'cooking_planner_auth_token';

/** Cognito 設定 */
export interface CognitoConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
}

/**
 * 環境変数から Cognito 設定を取得する
 *
 * @throws {Error} 必要な環境変数が未設定の場合
 */
export function getCognitoConfig(): CognitoConfig {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN as string | undefined;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI as string | undefined;

  const missing: string[] = [];
  if (!domain) missing.push('VITE_COGNITO_DOMAIN');
  if (!clientId) missing.push('VITE_COGNITO_CLIENT_ID');
  if (!redirectUri) missing.push('VITE_COGNITO_REDIRECT_URI');

  if (missing.length > 0) {
    throw new Error(`Cognito 設定に必要な環境変数が未設定です: ${missing.join(', ')}`);
  }

  return { domain: domain!, clientId: clientId!, redirectUri: redirectUri! };
}

/**
 * Cognito Hosted UI の認可 URL を生成する
 *
 * @see docs/05-architecture-notes.md §2.4
 */
export function buildLoginUrl(config: CognitoConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.redirectUri,
  });
  return `https://${config.domain}/oauth2/authorize?${params.toString()}`;
}

/** トークンエンドポイントのレスポンス型 */
export interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * 認可コードをトークンと交換する
 *
 * Cognito の `/oauth2/token` エンドポイントを呼び出し、
 * ID トークン・アクセストークン・リフレッシュトークンを取得します。
 *
 * @throws {Error} トークン取得に失敗した場合
 */
export async function exchangeCodeForTokens(
  config: CognitoConfig,
  code: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(`https://${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = (await response.json()) as {
        error?: string;
        error_description?: string;
      };
      detail = data.error_description ?? data.error ?? response.statusText;
    } catch {
      // レスポンスが JSON でない場合は statusText を使用
    }
    throw new Error(`トークン取得に失敗しました: ${detail}`);
  }

  return response.json() as Promise<TokenResponse>;
}

/** 認証トークンを localStorage に保存する */
export function saveAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

/** 認証トークンを localStorage から削除する */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
