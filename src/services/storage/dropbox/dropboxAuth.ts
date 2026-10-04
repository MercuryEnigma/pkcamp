import { StorageUnavailableError } from '../types'

export const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize'
export const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token'
export const REVOKE_URL = 'https://api.dropboxapi.com/2/auth/token/revoke'
export const SCOPES =
  'files.content.read files.content.write files.metadata.read'

/** The refresh token no longer works; the player must sign in again. */
export class DropboxSessionExpiredError extends StorageUnavailableError {
  constructor() {
    super('dropbox', 'Your Dropbox sign-in expired. Sign in to Dropbox again.')
    this.name = 'DropboxSessionExpiredError'
  }
}

export interface DropboxTokens {
  accessToken: string
  /** Absent when refreshing; Dropbox keeps the same refresh token. */
  refreshToken?: string
  expiresInSeconds: number
}

type Fetch = typeof fetch

/** URL-safe base64 without padding. */
export function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(byteLength: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

/** A 43-character PKCE code verifier. */
export function generateCodeVerifier(): string {
  return randomString(32)
}

/** A random `state` value that ties the redirect back to this tab. */
export function generateState(): string {
  return randomString(16)
}

/** The S256 challenge for a verifier. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return base64Url(new Uint8Array(digest))
}

export function buildAuthorizeUrl(options: {
  appKey: string
  redirectUri: string
  codeChallenge: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: options.appKey,
    response_type: 'code',
    redirect_uri: options.redirectUri,
    code_challenge: options.codeChallenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
    scope: SCOPES,
    state: options.state,
  })
  return `${AUTHORIZE_URL}?${params}`
}

async function postToken(
  fetchFn: Fetch,
  body: Record<string, string>
): Promise<DropboxTokens> {
  let response: Response
  try {
    response = await fetchFn(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
  } catch {
    throw new StorageUnavailableError(
      'dropbox',
      'Could not reach Dropbox. Check your connection and try again.'
    )
  }
  if (response.status === 400 || response.status === 401) {
    const detail = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    if (detail.error === 'invalid_grant' || response.status === 401) {
      throw new DropboxSessionExpiredError()
    }
    throw new Error(
      `Dropbox sign-in failed (${detail.error ?? 'bad request'}).`
    )
  }
  if (!response.ok) {
    throw new StorageUnavailableError(
      'dropbox',
      'Dropbox is having problems. Try again shortly.'
    )
  }
  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in ?? 14_400,
  }
}

/** Trades the redirect's `code` for tokens. */
export function exchangeCode(
  fetchFn: Fetch,
  options: {
    appKey: string
    redirectUri: string
    code: string
    codeVerifier: string
  }
): Promise<DropboxTokens> {
  return postToken(fetchFn, {
    grant_type: 'authorization_code',
    code: options.code,
    code_verifier: options.codeVerifier,
    client_id: options.appKey,
    redirect_uri: options.redirectUri,
  })
}

/** A new access token from a stored refresh token. */
export function refreshAccessToken(
  fetchFn: Fetch,
  options: { appKey: string; refreshToken: string }
): Promise<DropboxTokens> {
  return postToken(fetchFn, {
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
    client_id: options.appKey,
  })
}

/** Revokes the current token. Best effort: never throws. */
export async function revokeToken(
  fetchFn: Fetch,
  accessToken: string
): Promise<void> {
  try {
    await fetchFn(REVOKE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // The token is deleted locally regardless.
  }
}
