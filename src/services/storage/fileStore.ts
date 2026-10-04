/** A stored file and when it was last written. */
export interface StoredFile {
  bytes: Uint8Array
  modified: Date
}

/** One immediate child of a listed folder. */
export interface FileStoreEntry {
  name: string
  kind: 'file' | 'folder'
}

/**
 * The minimal path-based file system a storage provider is built on. Paths
 * are relative to the provider's root, use `/` separators, and never start
 * with `/`. Folders exist implicitly while they contain a file.
 *
 * IndexedDB and Dropbox both implement this, so both keep exactly the same
 * layout (see `FileStoreProvider`).
 */
export interface FileStore {
  read(path: string): Promise<StoredFile | null>
  write(path: string, bytes: Uint8Array, modified?: Date): Promise<void>
  /** Deletes a file, or a folder and everything in it. Missing is fine. */
  delete(path: string): Promise<void>
  /** Immediate children of a folder; empty when it does not exist. */
  list(folder: string): Promise<FileStoreEntry[]>
  /**
   * Loads the files `select` picks from every stored path ahead of use, for
   * stores with slow reads. Stores with fast reads leave it undefined.
   */
  prefetch?(select: (paths: string[]) => string[]): Promise<void>
}

/** Immediate children of `folder` among a flat set of file paths. */
export function childrenOf(
  paths: Iterable<string>,
  folder: string
): FileStoreEntry[] {
  const prefix = folder === '' ? '' : `${folder}/`
  const children = new Map<string, FileStoreEntry['kind']>()
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    const slash = rest.indexOf('/')
    if (slash < 0) children.set(rest, 'file')
    else children.set(rest.slice(0, slash), 'folder')
  }
  return [...children].map(([name, kind]) => ({ name, kind }))
}

/** True when `path` is `target` or lies inside the `target` folder. */
export function isWithin(path: string, target: string): boolean {
  return path === target || path.startsWith(`${target}/`)
}

/** A real, heap-only `FileStore`, used where no durable storage exists. */
export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, StoredFile>()

  async read(path: string): Promise<StoredFile | null> {
    const file = this.files.get(path)
    return file ? { bytes: file.bytes.slice(), modified: file.modified } : null
  }

  async write(
    path: string,
    bytes: Uint8Array,
    modified = new Date()
  ): Promise<void> {
    this.files.set(path, { bytes: bytes.slice(), modified })
  }

  async delete(path: string): Promise<void> {
    for (const key of [...this.files.keys()]) {
      if (isWithin(key, path)) this.files.delete(key)
    }
  }

  async list(folder: string): Promise<FileStoreEntry[]> {
    return childrenOf(this.files.keys(), folder)
  }
}
