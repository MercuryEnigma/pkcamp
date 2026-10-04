import { storage, localFileStore } from '../index'
import type { FileStore } from '../fileStore'
import { FileStoreProvider } from '../fileStoreProvider'
import type { StorageProvider } from '../types'
import { StorageUnavailableError } from '../types'
import {
  buildAuthorizeUrl,
  codeChallengeS256,
  exchangeCode,
  generateCodeVerifier,
  generateState,
  refreshAccessToken,
  revokeToken,
} from './dropboxAuth'
import { copyLocalToDropbox } from './copyLocalToDropbox'
import { DropboxFileStore, type DropboxTokenProvider } from './dropboxFileStore'

const TOKEN_PATH = 'accounts/dropbox.json'
const VERIFIER_KEY = 'pkcamp.dropbox.verifier'
const STATE_KEY = 'pkcamp.dropbox.state'
/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000

export type DropboxStatus = {
  state: 'signed-out' | 'connecting' | 'connected' | 'error'
  message?: string
}

/** Everything the account touches, injectable for tests. */
export interface DropboxAccountDeps {
  appKey: string | undefined
  redirectUri: string
  fetch: typeof fetch
  /** Where the refresh token is kept (browser IndexedDB in the app). */
  tokenStore: FileStore
  /** Source of the data copied up on connect. */
  localStore: FileStore
  /** Holds the PKCE verifier and state across the redirect. */
  session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  getLocation: () => { search: string; pathname: string; hash: string }
  navigate: (url: string) => void
  replaceUrl: (url: string) => void
  useProvider: (provider: StorageProvider | null) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

/** The Dropbox sign-in lifecycle; see `dropboxAccount` for the app's copy. */
export class DropboxAccount {
  private readonly deps: DropboxAccountDeps
  private readonly listeners = new Set<(status: DropboxStatus) => void>()
  private current: DropboxStatus = { state: 'signed-out' }
  private started: Promise<void> | null = null
  private accessToken: string | null = null
  private expiresAt = 0
  private refreshing: Promise<string> | null = null
  private refreshToken: string | null = null

  constructor(deps: DropboxAccountDeps) {
    this.deps = deps
  }

  /** False when no app key was built in; hide the Dropbox option. */
  isConfigured(): boolean {
    return Boolean(this.deps.appKey)
  }

  get status(): DropboxStatus {
    return this.current
  }

  subscribe(listener: (status: DropboxStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setStatus(status: DropboxStatus): void {
    this.current = status
    for (const listener of this.listeners) listener(status)
  }

  /** Sends the player to Dropbox to approve PkCamp. */
  async signIn(): Promise<void> {
    const appKey = this.deps.appKey
    if (!appKey) throw new Error('Dropbox is not configured.')
    const verifier = generateCodeVerifier()
    const state = generateState()
    const codeChallenge = await codeChallengeS256(verifier)
    this.deps.session.setItem(VERIFIER_KEY, verifier)
    this.deps.session.setItem(STATE_KEY, state)
    this.setStatus({ state: 'connecting' })
    this.deps.navigate(
      buildAuthorizeUrl({
        appKey,
        redirectUri: this.deps.redirectUri,
        codeChallenge,
        state,
      })
    )
  }

  /**
   * Finishes a pending sign-in redirect or restores the stored sign-in.
   * Safe to call more than once; every call shares one run.
   */
  initialize(): Promise<void> {
    this.started ??= this.start()
    return this.started
  }

  private async start(): Promise<void> {
    if (!this.isConfigured()) return
    try {
      const params = new URLSearchParams(this.deps.getLocation().search)
      if (params.has('state') && (params.has('code') || params.has('error'))) {
        await this.completeRedirect(params)
        return
      }
      const stored = await this.readStoredToken()
      if (!stored) return
      this.refreshToken = stored
      await this.connect(false)
    } catch (error) {
      this.setStatus({ state: 'error', message: message(error) })
    }
  }

  private removeAuthParams(params: URLSearchParams): void {
    for (const key of ['code', 'state', 'error', 'error_description']) {
      params.delete(key)
    }
    const { pathname, hash } = this.deps.getLocation()
    const query = params.toString()
    this.deps.replaceUrl(`${pathname}${query ? `?${query}` : ''}${hash}`)
  }

  private async completeRedirect(params: URLSearchParams): Promise<void> {
    const code = params.get('code')
    const error = params.get('error')
    const state = params.get('state')
    const { session } = this.deps
    const expectedState = session.getItem(STATE_KEY)
    const verifier = session.getItem(VERIFIER_KEY)
    session.removeItem(STATE_KEY)
    session.removeItem(VERIFIER_KEY)
    this.removeAuthParams(params)

    if (!expectedState || state !== expectedState || !verifier) {
      this.setStatus({
        state: 'error',
        message: 'The Dropbox sign-in could not be verified. Try again.',
      })
      return
    }
    if (error || !code) {
      this.setStatus({
        state: 'signed-out',
        message: 'Dropbox sign-in was cancelled.',
      })
      return
    }
    this.setStatus({ state: 'connecting' })
    const tokens = await exchangeCode(this.deps.fetch, {
      appKey: this.deps.appKey!,
      redirectUri: this.deps.redirectUri,
      code,
      codeVerifier: verifier,
    })
    if (!tokens.refreshToken) {
      throw new Error('Dropbox did not allow PkCamp to stay signed in.')
    }
    this.refreshToken = tokens.refreshToken
    this.accessToken = tokens.accessToken
    this.expiresAt = this.now() + tokens.expiresInSeconds * 1000
    await this.writeStoredToken(tokens.refreshToken)
    await this.connect(true)
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  private async readStoredToken(): Promise<string | null> {
    const file = await this.deps.tokenStore.read(TOKEN_PATH)
    if (!file) return null
    try {
      const data = JSON.parse(new TextDecoder().decode(file.bytes)) as {
        refreshToken?: string
        appKey?: string
      }
      // A token from a different Dropbox app cannot be used with this key.
      if (data.appKey !== this.deps.appKey) return null
      return data.refreshToken ?? null
    } catch {
      return null
    }
  }

  private async writeStoredToken(refreshToken: string): Promise<void> {
    const body = JSON.stringify({ refreshToken, appKey: this.deps.appKey })
    await this.deps.tokenStore.write(TOKEN_PATH, new TextEncoder().encode(body))
  }

  /** Token source for the file store: cached, deduplicated, self-refreshing. */
  private readonly tokens: DropboxTokenProvider = {
    getAccessToken: async (forceRefresh = false) => {
      if (
        !forceRefresh &&
        this.accessToken &&
        this.now() < this.expiresAt - EXPIRY_MARGIN_MS
      ) {
        return this.accessToken
      }
      if (this.refreshing) return this.refreshing
      const refreshToken = this.refreshToken
      if (!refreshToken) {
        throw new StorageUnavailableError(
          'dropbox',
          'You are signed out of Dropbox. Sign in to Dropbox again.'
        )
      }
      const run = (async () => {
        try {
          const tokens = await refreshAccessToken(this.deps.fetch, {
            appKey: this.deps.appKey!,
            refreshToken,
          })
          this.accessToken = tokens.accessToken
          this.expiresAt = this.now() + tokens.expiresInSeconds * 1000
          if (this.current.state === 'error' && this.tokenFailed) {
            this.tokenFailed = false
            this.setStatus({ state: 'connected' })
          }
          return tokens.accessToken
        } catch (error) {
          this.accessToken = null
          this.tokenFailed = true
          this.setStatus({ state: 'error', message: message(error) })
          throw error
        } finally {
          this.refreshing = null
        }
      })()
      this.refreshing = run
      return run
    },
  }
  private tokenFailed = false

  private createProvider(): { provider: StorageProvider; store: FileStore } {
    // One store, and so one cache, per connection; the copy-up below goes
    // through it too.
    const store = new DropboxFileStore(this.tokens, {
      fetch: this.deps.fetch,
      sleep: this.deps.sleep,
    })
    const provider = new FileStoreProvider(store, {
      id: 'dropbox',
      label: 'Dropbox',
    })
    return { provider, store }
  }

  /** Activates Dropbox; `fresh` also copies this browser's data up. */
  private async connect(fresh: boolean): Promise<void> {
    const { provider, store } = this.createProvider()
    this.setStatus({ state: 'connecting' })
    try {
      await this.tokens.getAccessToken()
    } catch (error) {
      // Stay signed in but read-only: operations report the problem and
      // nothing falls back to local storage.
      this.deps.useProvider(provider)
      this.setStatus({ state: 'error', message: message(error) })
      return
    }
    let copyError: unknown = null
    if (fresh) {
      try {
        await copyLocalToDropbox(this.deps.localStore, store)
      } catch (error) {
        copyError = error
      }
    }
    this.deps.useProvider(provider)
    this.setStatus(
      copyError
        ? {
            state: 'error',
            message: `Signed in to Dropbox, but copying this browser's data failed: ${message(copyError)}`,
          }
        : { state: 'connected' }
    )
  }

  /** Revokes the token, forgets it, and returns to browser storage. */
  async signOut(): Promise<void> {
    if (this.accessToken || this.refreshToken) {
      try {
        const token = this.accessToken ?? (await this.tokens.getAccessToken())
        await revokeToken(this.deps.fetch, token)
      } catch {
        // Best effort.
      }
    }
    await this.deps.tokenStore.delete(TOKEN_PATH)
    this.accessToken = null
    this.refreshToken = null
    this.expiresAt = 0
    this.tokenFailed = false
    this.deps.useProvider(null)
    this.setStatus({ state: 'signed-out' })
  }
}

/** The key baked in at build time, if any. */
export function dropboxAppKey(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env.VITE_DROPBOX_APP_KEY || undefined
}

/** The app's Dropbox account. Call `initialize()` once at startup. */
export const dropboxAccount = new DropboxAccount({
  appKey: dropboxAppKey(),
  get redirectUri() {
    return `${location.origin}${import.meta.env.BASE_URL}`
  },
  fetch: (input, init) => fetch(input, init),
  tokenStore: localFileStore,
  localStore: localFileStore,
  session: {
    getItem: (key) => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: (key) => sessionStorage.removeItem(key),
  },
  getLocation: () => location,
  navigate: (url) => location.assign(url),
  replaceUrl: (url) => history.replaceState(history.state, '', url),
  useProvider: (provider) => storage.use(provider),
})
