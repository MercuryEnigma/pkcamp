import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Checks the generated browser runtime against the release our notices were
 * taken from. A different major.minor line fails the build; a servicing (patch)
 * difference only warns, and the packager links that exact release's notices.
 */
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
  const line = (v) => v.split('.').slice(0, 2).join('.')
  if (line(version) !== line(expectedVersion)) {
    throw new Error(
      `Browser runtime ${version} is outside the ${line(expectedVersion)} line covered by notices ${expectedVersion}; update vendor/dotnet-runtime-notices`
    )
  }
  if (version !== expectedVersion) {
    console.warn(
      `Browser runtime ${version} differs from notice version ${expectedVersion}; linking the exact release. Refresh vendor/dotnet-runtime-notices when convenient.`
    )
  }
  return version
}
