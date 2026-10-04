import { describe, expect, it, vi } from 'vitest'
import { StorageUnavailableError } from '../types'
import {
  base64Url,
  buildAuthorizeUrl,
  codeChallengeS256,
  DropboxSessionExpiredError,
  exchangeCode,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
  revokeToken,
} from './dropboxAuth'

describe('PKCE helpers', () => {
  it('generates URL-safe verifiers of valid length', () => {
    const verifier = generateCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateCodeVerifier()).not.toBe(verifier)
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]{22}$/)
  })

  it('computes the RFC 7636 S256 challenge', async () => {
    expect(
      await codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('base64url encodes without padding', () => {
    expect(base64Url(new Uint8Array([251, 255]))).toBe('-_8')
  })
})

describe('buildAuthorizeUrl', () => {
  it('requests offline access with PKCE and scopes', () => {
    const url = new URL(
      buildAuthorizeUrl({
        appKey: 'key',
        redirectUri: 'https://x.test/pkcamp/',
        codeChallenge: 'chal',
        state: 'st',
      })
    )
    expect(url.origin + url.pathname).toBe(
      'https://www.dropbox.com/oauth2/authorize'
    )
    const p = url.searchParams
    expect(p.get('client_id')).toBe('key')
    expect(p.get('response_type')).toBe('code')
    expect(p.get('redirect_uri')).toBe('https://x.test/pkcamp/')
    expect(p.get('code_challenge')).toBe('chal')
    expect(p.get('code_challenge_method')).toBe('S256')
    expect(p.get('token_access_type')).toBe('offline')
    expect(p.get('scope')).toBe(
      'files.content.read files.content.write files.metadata.read'
    )
    expect(p.get('state')).toBe('st')
  })
})

describe('token endpoint', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body))

  it('exchanges a code', async () => {
    const fetchFn = vi.fn(async () =>
      ok({ access_token: 'a', refresh_token: 'r', expires_in: 100 })
    )
    const tokens = await exchangeCode(fetchFn, {
      appKey: 'key',
      redirectUri: 'https://x.test/pkcamp/',
      code: 'c',
      codeVerifier: 'v',
    })
    expect(tokens).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresInSeconds: 100,
    })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://api.dropboxapi.com/oauth2/token')
    const body = init.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'authorization_code',
      code: 'c',
      code_verifier: 'v',
      client_id: 'key',
      redirect_uri: 'https://x.test/pkcamp/',
    })
  })

  it('refreshes', async () => {
    const fetchFn = vi.fn(async () => ok({ access_token: 'b', expires_in: 5 }))
    const tokens = await refreshAccessToken(fetchFn, {
      appKey: 'k',
      refreshToken: 'r',
    })
    expect(tokens.accessToken).toBe('b')
    const init = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(Object.fromEntries(init[1].body as URLSearchParams)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'r',
      client_id: 'k',
    })
  })

  it('maps invalid_grant, network, and server errors', async () => {
    const run = (fetchFn: typeof fetch) =>
      refreshAccessToken(fetchFn, { appKey: 'k', refreshToken: 'r' })
    await expect(
      run(
        async () => new Response('{"error":"invalid_grant"}', { status: 400 })
      )
    ).rejects.toBeInstanceOf(DropboxSessionExpiredError)
    await expect(
      run(async () => {
        throw new TypeError('offline')
      })
    ).rejects.toBeInstanceOf(StorageUnavailableError)
    await expect(
      run(async () => new Response('', { status: 502 }))
    ).rejects.toBeInstanceOf(StorageUnavailableError)
  })

  it('revokes with a bearer token and never throws', async () => {
    const fetchFn = vi.fn(async () => new Response('{}'))
    await revokeToken(fetchFn, 'tok')
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://api.dropboxapi.com/2/auth/token/revoke')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer tok'
    )
    await expect(
      revokeToken(async () => {
        throw new Error('x')
      }, 't')
    ).resolves.toBeUndefined()
  })
})
