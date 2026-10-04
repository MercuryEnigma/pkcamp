/** An in-memory Dropbox HTTP API for tests: files, folders, paging. */
export interface FakeDropbox {
  fetch: typeof fetch
  files: Map<string, { bytes: Uint8Array; modified: string }>
  requests: { url: string; headers: Headers; body?: unknown }[]
}

function apiError(summary: string): Response {
  return new Response(JSON.stringify({ error_summary: summary }), {
    status: 409,
  })
}

export function createFakeDropbox(pageSize = 1000): FakeDropbox {
  const files: FakeDropbox['files'] = new Map()
  const requests: FakeDropbox['requests'] = []

  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    requests.push({ url, headers, body: init?.body })
    const endpoint = new URL(url).pathname
    const arg = headers.get('Dropbox-API-Arg')
      ? (JSON.parse(headers.get('Dropbox-API-Arg')!) as Record<string, string>)
      : null
    const json =
      typeof init?.body === 'string'
        ? (JSON.parse(init.body) as Record<string, string>)
        : null

    if (endpoint === '/2/files/download') {
      const file = files.get(arg!.path)
      if (!file) return apiError('path/not_found/..')
      return new Response(file.bytes as BodyInit, {
        headers: {
          'Dropbox-API-Result': JSON.stringify({
            client_modified: file.modified,
          }),
        },
      })
    }
    if (endpoint === '/2/files/upload') {
      files.set(arg!.path, {
        bytes: (init!.body as Uint8Array).slice(),
        modified: arg!.client_modified,
      })
      return new Response('{}')
    }
    if (endpoint === '/2/files/delete_v2') {
      const target = json!.path
      const hit = [...files.keys()].filter(
        (key) => key === target || key.startsWith(`${target}/`)
      )
      if (!hit.length) return apiError('path_lookup/not_found/..')
      for (const key of hit) files.delete(key)
      return new Response('{}')
    }
    if (endpoint === '/2/files/list_folder' || endpoint.endsWith('/continue')) {
      let folder: string
      let offset = 0
      let recursive: boolean
      if (endpoint.endsWith('/continue')) {
        const [cursorFolder, cursorOffset, cursorRecursive] =
          json!.cursor.split('|')
        folder = cursorFolder
        offset = Number(cursorOffset)
        recursive = cursorRecursive === 'r'
      } else {
        folder = json!.path
        recursive = (json!.recursive as unknown) === true
      }
      const prefix = `${folder}/`
      // name, tag, full path
      const children = new Map<string, [string, string]>()
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        const slash = rest.indexOf('/')
        if (recursive) children.set(key, ['file', key])
        else if (slash < 0) children.set(rest, ['file', key])
        else
          children.set(rest.slice(0, slash), [
            'folder',
            `${prefix}${rest.slice(0, slash)}`,
          ])
      }
      // Like Dropbox, the app folder root always exists.
      if (!children.size && folder !== '' && !endpoint.endsWith('/continue')) {
        return apiError('path/not_found/..')
      }
      const all = [...children]
      const page = all.slice(offset, offset + pageSize)
      return new Response(
        JSON.stringify({
          entries: page.map(([name, [tag, path]]) => ({
            '.tag': tag,
            name: recursive ? path.slice(path.lastIndexOf('/') + 1) : name,
            path_display: path,
          })),
          cursor: `${folder}|${offset + pageSize}|${recursive ? 'r' : ''}`,
          has_more: offset + pageSize < all.length,
        })
      )
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch

  return { fetch: fakeFetch, files, requests }
}
