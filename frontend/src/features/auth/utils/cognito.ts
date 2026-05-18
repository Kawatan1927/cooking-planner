/**
 * Cognito Hosted UI 連携ユーティリティ
 *
 * Authorization Code Grant + PKCE フローを使って Cognito Hosted UI 経由の
 * ログインをサポートします。
 *
 * @see docs/05-architecture-notes.md §2.4
 */

/** localStorage に保存する認証トークンのキー */
export const AUTH_TOKEN_STORAGE_KEY = 'cooking_planner_auth_token';

/** sessionStorage に保存する OAuth state のキー（CSRF 対策） */
const AUTH_STATE_KEY = 'cooking_planner_auth_state';

/** sessionStorage に保存する PKCE code_verifier のキー */
const AUTH_CODE_VERIFIER_KEY = 'cooking_planner_code_verifier';

/** ログアウト状態を表す localStorage のマーカー値 */
const AUTH_LOGGED_OUT_MARKER = '__LOGGED_OUT__';

/** Cognito 設定 */
export interface CognitoConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
}

/** 認証トークンを localStorage（未設定時は環境変数）から取得する */
export function getAuthToken(): string | null {
  const envToken = import.meta.env.VITE_AUTH_TOKEN ?? null;

  if (typeof window === 'undefined') {
    return envToken;
  }

  const storedTokenRaw = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const storedToken =
    storedTokenRaw === AUTH_LOGGED_OUT_MARKER || storedTokenRaw === '' ? null : storedTokenRaw;

  if (storedToken !== null) {
    return storedToken;
  }

  return envToken;
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

// ---------------------------------------------------------------------------
// State（CSRF 対策）
// ---------------------------------------------------------------------------

/**
 * ランダムな base64url 文字列を生成する
 */
function generateRandomBase64url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** OAuth state 値を sessionStorage に保存する */
function saveAuthState(state: string): void {
  sessionStorage.setItem(AUTH_STATE_KEY, state);
}

/**
 * コールバックで受け取った state を検証し、sessionStorage の値を削除する
 *
 * @returns 検証成功なら true、不一致または未設定なら false
 */
export function validateAndClearAuthState(receivedState: string): boolean {
  const expected = sessionStorage.getItem(AUTH_STATE_KEY);
  sessionStorage.removeItem(AUTH_STATE_KEY);
  return expected !== null && expected === receivedState;
}

// ---------------------------------------------------------------------------
// PKCE（認可コード差し替え対策）
// ---------------------------------------------------------------------------

/** PKCE code_verifier を sessionStorage に保存する */
function saveCodeVerifier(verifier: string): void {
  sessionStorage.setItem(AUTH_CODE_VERIFIER_KEY, verifier);
}

/**
 * PKCE code_verifier を sessionStorage から取り出し、削除する（一度しか読めない）
 *
 * @returns code_verifier の文字列、未設定なら null
 */
export function getAndClearCodeVerifier(): string | null {
  const verifier = sessionStorage.getItem(AUTH_CODE_VERIFIER_KEY);
  sessionStorage.removeItem(AUTH_CODE_VERIFIER_KEY);
  return verifier;
}

/**
 * PKCE S256 code_challenge を生成する
 *
 * @param verifier - code_verifier 文字列
 * @returns base64url エンコードされた SHA-256 ハッシュ
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Login URL 生成
// ---------------------------------------------------------------------------

/**
 * Cognito Hosted UI の認可 URL を生成する
 *
 * CSRF 対策として state パラメータを、認可コード差し替え対策として
 * PKCE（S256）を付与します。state と code_verifier は sessionStorage に保存します。
 *
 * @see docs/05-architecture-notes.md §2.4
 */
export async function buildLoginUrl(config: CognitoConfig): Promise<string> {
  const state = generateRandomBase64url(32);
  const codeVerifier = generateRandomBase64url(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  saveAuthState(state);
  saveCodeVerifier(codeVerifier);

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: config.redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://${config.domain}/oauth2/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// トークン交換
// ---------------------------------------------------------------------------

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
 * @param codeVerifier - PKCE code_verifier（使用した場合は必須）
 * @throws {Error} トークン取得に失敗した場合
 */
export async function exchangeCodeForTokens(
  config: CognitoConfig,
  code: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
  });

  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

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

// ---------------------------------------------------------------------------
// トークン保存
// ---------------------------------------------------------------------------

/** 認証トークンを localStorage に保存する */
export function saveAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

/** 認証トークンを localStorage から削除する */
export function clearAuthToken(): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, AUTH_LOGGED_OUT_MARKER);
}
