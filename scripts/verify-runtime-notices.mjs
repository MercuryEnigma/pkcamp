import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Fail closed if a workload update changes the runtime covered by our notices. */
export function verifyRuntimeNotices(framework, expectedVersion) {
  const files = readdirSync(framework).filter((name) =>
    /^dotnet\.runtime(?:\.[\w-]+)?\.js$/.test(name)
  )
  if (files.length !== 1) {
    throw new Error('Expected exactly one generated .NET browser runtime')
  }
  const source = readFileSync(join(framework, files[0]), 'utf8')
  const identifier = source.match(/productVersion\s*:\s*([\w$]+)/)?.[1]
  const escaped = identifier?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const version = escaped
    ? source.match(
        new RegExp(
          `(?:var|let|const)\\s+${escaped}\\s*=\\s*["'](\\d+\\.\\d+\\.\\d+)["']`
        )
      )?.[1]
    : undefined
  if (!version) {
    throw new Error(
      'Cannot determine generated browser runtime product version; review its notices'
    )
  }
  if (version !== expectedVersion) {
    throw new Error(
      `Browser runtime ${version} does not match notice version ${expectedVersion}; update the runtime notices and pin together`
    )
  }
  return version
}
