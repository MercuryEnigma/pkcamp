import {
  childrenOf,
  isWithin,
  type FileStore,
  type FileStoreEntry,
  type StoredFile,
} from '../fileStore'
import { StorageUnavailableError } from '../types'

const CONTENT_URL = 'https://content.dropboxapi.com/2/files'
const API_URL = 'https://api.dropboxapi.com/2/files'
const MAX_RATE_LIMIT_RETRIES = 3
const MAX_RETRY_WAIT_MS = 30_000
const PREFETCH_CONCURRENCY = 6

/** Supplies short-lived Dropbox access tokens. */
export interface DropboxTokenProvider {
  /** A valid access token; `forceRefresh` discards any cached one. */
  getAccessToken(forceRefresh?: boolean): Promise<string>
}

export interface DropboxFileStoreOptions {
  /** Fetch override for tests. */
  fetch?: typeof fetch
  /** Delay override for tests; used between 429 retries. */
  sleep?: (ms: number) => Promise<void>
}

/** Dropbox needs non-ASCII characters in header JSON as `\uXXXX`. */
export function escapeHeaderJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[\u007f-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  )
}

/** Dropbox wants ISO 8601 UTC without milliseconds. */
export function dropboxTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** A FileStore path as an app-folder path: `a/b` is `/a/b`, root is ``. */
function dropboxPath(path: string): string {
  return path === '' ? '' : `/${path}`
}

function unavailable(message: string): StorageUnavailableError {
  return new StorageUnavailableError('dropbox', message)
}

async function errorSummary(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error_summary?: string }
    return body.error_summary ?? ''
  } catch {
    return ''
  }
}

interface ListedEntry {
  '.tag': string
  name: string
  path_display: string
}

interface ListPage {
  entries: ListedEntry[]
  cursor: string
  has_more: boolean
}

type TreeChange = { kind: 'add' | 'delete'; path: string }

function copyFile(file: StoredFile | null): StoredFile | null {
  return file && { bytes: file.bytes.slice(), modified: file.modified }
}

function applyChange(tree: Set<string>, change: TreeChange): void {
  if (change.kind === 'add') {
    tree.add(change.path)
    return
  }
  for (const path of [...tree]) {
    if (isWithin(path, change.path)) tree.delete(path)
  }
}

/**
 * `FileStore` over the Dropbox HTTP API, rooted at the app folder.
 *
 * Every Dropbox round trip is slow, so the store keeps a session cache:
 * reads are cached and shared while in flight, and writes and deletes go to
 * Dropbox first and then update the cache. `prefetch` lists the whole app
 * folder in one call; after that, folder listings and reads of missing
 * files need no network at all. Changes made from another device are not
 * seen until a new store is created (the next page load or sign-in).
 */
export class DropboxFileStore implements FileStore {
  private readonly tokens: DropboxTokenProvider
  private readonly fetchFn: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly files = new Map<string, Promise<StoredFile | null>>()
  /** Every file path in the app folder, once listed. */
  private tree: Set<string> | null = null
  private treeLoading: Promise<void> | null = null
  /** Writes and deletes made while the tree was loading. */
  private changesDuringLoad: TreeChange[] = []

  constructor(
    tokens: DropboxTokenProvider,
    options: DropboxFileStoreOptions = {}
  ) {
    this.tokens = tokens
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init))
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  }

  /**
   * One authorized request with the shared failure rules: 429 waits and
   * retries, 401 refreshes the token once, and network errors, 5xx and
   * authorization failures become `StorageUnavailableError`. Other statuses
   * are returned for the caller (409 is a Dropbox API error).
   */
  private async send(
    url: string,
    init: { headers?: Record<string, string>; body?: BodyInit }
  ): Promise<Response> {
    let refreshed = false
    let rateLimited = 0
    for (;;) {
      const token = await this.tokens.getAccessToken(refreshed)
      let response: Response
      try {
        response = await this.fetchFn(url, {
          method: 'POST',
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
          body: init.body,
        })
      } catch {
        throw unavailable(
          'Could not reach Dropbox. Check your connection and try again.'
        )
      }

      if (response.status === 401) {
        if (!refreshed) {
          refreshed = true
          continue
        }
        throw unavailable(
          'Dropbox rejected the sign-in. Sign in to Dropbox again.'
        )
      }
      if (response.status === 429) {
        if (rateLimited >= MAX_RATE_LIMIT_RETRIES) {
          throw unavailable('Dropbox is busy right now. Try again shortly.')
        }
        rateLimited++
        const seconds = Number(response.headers.get('Retry-After'))
        const wait =
          Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000
        await this.sleep(Math.min(wait, MAX_RETRY_WAIT_MS))
        continue
      }
      if (response.status >= 500) {
        throw unavailable('Dropbox is having problems. Try again shortly.')
      }
      if (response.status === 403) {
        throw unavailable(
          'Dropbox denied access to PkCamp data. Sign in to Dropbox again.'
        )
      }
      return response
    }
  }

  private async failure(response: Response, what: string): Promise<Error> {
    const summary = await errorSummary(response)
    return new Error(
      `Dropbox could not ${what} (${response.status} ${summary}).`
    )
  }

  private async json<T>(
    endpoint: string,
    body: unknown,
    what: string,
    notFound?: 'ok'
  ): Promise<T | null> {
    const response = await this.send(`${API_URL}/${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) return (await response.json()) as T
    if (notFound && response.status === 409) {
      const summary = await errorSummary(response)
      if (summary.includes('not_found')) return null
      throw new Error(`Dropbox could not ${what} (409 ${summary}).`)
    }
    throw await this.failure(response, what)
  }

  async read(path: string): Promise<StoredFile | null> {
    let pending = this.files.get(path)
    if (!pending) {
      if (this.tree && !this.tree.has(path)) return null
      const download = this.download(path)
      pending = download
      this.files.set(path, download)
      // A failed read (offline) must be retried later, not cached.
      download.catch(() => {
        if (this.files.get(path) === download) this.files.delete(path)
      })
    }
    return copyFile(await pending)
  }

  async write(
    path: string,
    bytes: Uint8Array,
    modified: Date = new Date()
  ): Promise<void> {
    await this.upload(path, bytes, modified)
    // Cache the time Dropbox keeps, which has no milliseconds.
    const stored = {
      bytes: bytes.slice(),
      modified: new Date(dropboxTime(modified)),
    }
    this.files.set(path, Promise.resolve(stored))
    this.recordChange({ kind: 'add', path })
  }

  async delete(path: string): Promise<void> {
    await this.json(
      'delete_v2',
      { path: dropboxPath(path) },
      `delete ${path}`,
      'ok'
    )
    for (const key of [...this.files.keys()]) {
      if (isWithin(key, path)) this.files.delete(key)
    }
    this.files.set(path, Promise.resolve(null))
    this.recordChange({ kind: 'delete', path })
  }

  async list(folder: string): Promise<FileStoreEntry[]> {
    if (this.treeLoading) await this.treeLoading.catch(() => {})
    if (this.tree) return childrenOf(this.tree, folder)
    return (await this.listFolder(folder, false)).flatMap(
      (entry): FileStoreEntry[] =>
        entry['.tag'] === 'file' || entry['.tag'] === 'folder'
          ? [{ name: entry.name, kind: entry['.tag'] }]
          : []
    )
  }

  /** Lists the app folder once, then downloads the paths `select` picks. */
  async prefetch(select: (paths: string[]) => string[]): Promise<void> {
    await this.loadTree()
    const queue = select([...this.tree!])
    const worker = async () => {
      for (let path = queue.shift(); path; path = queue.shift()) {
        await this.read(path)
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(PREFETCH_CONCURRENCY, queue.length) },
        worker
      )
    )
  }

  private loadTree(): Promise<void> {
    if (this.tree) return Promise.resolve()
    this.treeLoading ??= this.listFolder('', true)
      .then((entries) => {
        const tree = new Set(
          entries
            .filter((entry) => entry['.tag'] === 'file')
            .map((entry) => entry.path_display.replace(/^\//, ''))
        )
        for (const change of this.changesDuringLoad) applyChange(tree, change)
        this.tree = tree
      })
      .finally(() => {
        this.treeLoading = null
        this.changesDuringLoad = []
      })
    return this.treeLoading
  }

  private recordChange(change: TreeChange): void {
    if (this.tree) applyChange(this.tree, change)
    else if (this.treeLoading) this.changesDuringLoad.push(change)
  }

  private async download(path: string): Promise<StoredFile | null> {
    const response = await this.send(`${CONTENT_URL}/download`, {
      headers: {
        'Dropbox-API-Arg': escapeHeaderJson({ path: dropboxPath(path) }),
      },
    })
    if (response.status === 409) {
      const summary = await errorSummary(response)
      if (summary.includes('not_found')) return null
      throw new Error(`Dropbox could not read ${path} (409 ${summary}).`)
    }
    if (!response.ok) throw await this.failure(response, `read ${path}`)

    let modified = new Date()
    try {
      const result = JSON.parse(
        response.headers.get('Dropbox-API-Result') ?? '{}'
      ) as { client_modified?: string }
      if (result.client_modified) modified = new Date(result.client_modified)
    } catch {
      // Keep the fallback time.
    }
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await response.arrayBuffer())
    } catch {
      throw unavailable('Dropbox stopped responding. Try again.')
    }
    return { bytes, modified }
  }

  private async upload(
    path: string,
    bytes: Uint8Array,
    modified: Date
  ): Promise<void> {
    const response = await this.send(`${CONTENT_URL}/upload`, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': escapeHeaderJson({
          path: dropboxPath(path),
          mode: 'overwrite',
          autorename: false,
          mute: true,
          client_modified: dropboxTime(modified),
        }),
      },
      body: bytes as BodyInit,
    })
    if (!response.ok) {
      const summary = await errorSummary(response)
      if (summary.includes('insufficient_space')) {
        throw unavailable('Your Dropbox is full, so PkCamp could not save.')
      }
      throw new Error(
        `Dropbox could not save ${path} (${response.status} ${summary}).`
      )
    }
  }

  /** Every entry under `folder`, following `has_more` pages. */
  private async listFolder(
    folder: string,
    recursive: boolean
  ): Promise<ListedEntry[]> {
    const what = `list ${folder || 'the app folder'}`
    const entries: ListedEntry[] = []
    let page = await this.json<ListPage>(
      'list_folder',
      { path: dropboxPath(folder), recursive },
      what,
      'ok'
    )
    while (page) {
      entries.push(...page.entries)
      if (!page.has_more) break
      page = await this.json<ListPage>(
        'list_folder/continue',
        { cursor: page.cursor },
        what
      )
    }
    return entries
  }
}
