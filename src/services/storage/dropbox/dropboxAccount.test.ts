import { describe, expect, it, vi } from 'vitest'
import { MemoryFileStore } from '../fileStore'
import type { StorageProvider } from '../types'
import { DropboxAccount, type DropboxAccountDeps } from './dropboxAccount'
import { createFakeDropbox } from './fakeDropbox'

function setup(search = '', appKey: string | undefined = 'key') {
  const dropbox = createFakeDropbox()
  const session = new Map<string, string>()
  const local = new MemoryFileStore()
  let url = `/pkcamp/${search}`
  const navigated: string[] = []
  const used: (StorageProvider | null)[] = []
  let tokenCalls = 0
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/oauth2/token')) {
      tokenCalls++
      const body = init!.body as URLSearchParams
      return new Response(
        JSON.stringify({
          access_token: `access${tokenCalls}`,
          ...(body.get('grant_type') === 'authorization_code'
            ? { refresh_token: 'refresh1' }
            : {}),
          expires_in: 14400,
        })
      )
    }
    return dropbox.fetch(input, init)
  }) as typeof fetch
  const deps: DropboxAccountDeps = {
    appKey,
    redirectUri: 'https://x.test/pkcamp/',
    fetch: fetchFn,
    tokenStore: local,
    localStore: local,
    session: {
      getItem: (k) => session.get(k) ?? null,
      setItem: (k, v) => void session.set(k, v),
      removeItem: (k) => void session.delete(k),
    },
    getLocation: () => {
      const [path, query = ''] = url.split('?')
      return { pathname: path, search: query ? `?${query}` : '', hash: '' }
    },
    navigate: (u) => void navigated.push(u),
    replaceUrl: (u) => void (url = u),
    useProvider: (p) => void used.push(p),
    sleep: async () => {},
  }
  return {
    account: new DropboxAccount(deps),
    dropbox,
    session,
    local,
    navigated,
    used,
    getUrl: () => url,
  }
}

describe('DropboxAccount', () => {
  it('is unconfigured without an app key', async () => {
    const { account, used } = setup('', '')
    expect(account.isConfigured()).toBe(false)
    await account.initialize()
    expect(account.status.state).toBe('signed-out')
    expect(used).toEqual([])
  })

  it('signs in via redirect, copies local data once, and signs out', async () => {
    const first = setup()
    await first.account.signIn()
    const authorize = new URL(first.navigated[0])
    const state = authorize.searchParams.get('state')!
    expect(first.session.get('pkcamp.dropbox.state')).toBe(state)

    // Back from Dropbox, in a new page load.
    const back = setup(`?code=abc&state=${state}`)
    back.session.set('pkcamp.dropbox.state', state)
    back.session.set('pkcamp.dropbox.verifier', 'verifier')
    await back.local.write('settings.json', new Uint8Array([1]))
    await back.account.initialize()
    await back.account.initialize()

    expect(back.account.status).toEqual({ state: 'connected' })
    expect(back.getUrl()).toBe('/pkcamp/')
    expect(back.session.size).toBe(0)
    expect(back.used).toHaveLength(1)
    expect(back.used[0]!.id).toBe('dropbox')
    expect(back.dropbox.files.has('/settings.json')).toBe(true)
    expect(
      JSON.parse(
        new TextDecoder().decode(
          (await back.local.read('accounts/dropbox.json'))!.bytes
        )
      )
    ).toEqual({
      refreshToken: 'refresh1',
      appKey: 'key',
    })

    await back.account.signOut()
    expect(back.account.status.state).toBe('signed-out')
    expect(back.used.at(-1)).toBeNull()
    expect(await back.local.read('accounts/dropbox.json')).toBeNull()
    expect(back.dropbox.requests.at(-1)!.url).toContain('/auth/token/revoke')
  })

  it('rejects a mismatched state', async () => {
    const t = setup('?code=abc&state=evil')
    t.session.set('pkcamp.dropbox.state', 'good')
    t.session.set('pkcamp.dropbox.verifier', 'v')
    await t.account.initialize()
    expect(t.account.status.state).toBe('error')
    expect(t.used).toEqual([])
    expect(t.getUrl()).toBe('/pkcamp/')
  })

  it('restores a stored sign-in without copying local data', async () => {
    const t = setup()
    await t.local.write(
      'accounts/dropbox.json',
      new TextEncoder().encode('{"refreshToken":"r","appKey":"key"}')
    )
    await t.local.write('settings.json', new Uint8Array([1]))
    await t.account.initialize()
    expect(t.account.status).toEqual({ state: 'connected' })
    expect(t.used[0]!.id).toBe('dropbox')
    expect(t.dropbox.files.size).toBe(0)
  })

  it('stays on Dropbox in an error state when the token cannot refresh', async () => {
    const t = setup()
    await t.local.write(
      'accounts/dropbox.json',
      new TextEncoder().encode('{"refreshToken":"r","appKey":"key"}')
    )
    ;(t.account as unknown as { deps: DropboxAccountDeps }).deps.fetch = vi.fn(
      async () => {
        throw new TypeError('offline')
      }
    )
    await t.account.initialize()
    expect(t.account.status.state).toBe('error')
    expect(t.used[0]!.id).toBe('dropbox')
  })
})
