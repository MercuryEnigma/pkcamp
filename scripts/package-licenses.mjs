import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyRuntimeNotices } from './verify-runtime-notices.mjs'

// Publish notices alongside the app. Source access uses GitHub, never archives.
const root = resolve(fileURLToPath(new URL('../', import.meta.url)))
const read = (path) => readFileSync(join(root, path), 'utf8')
/**
 * Writes `licenses/` into `output`. `framework` is the
 * pkhex-wasm `_framework` directory whose runtime version the notices cover.
 * The production build packages into `dist/`.
 */
export function packageLicenses({ output, framework }) {
  const noticeVersion = JSON.parse(
    read('vendor/dotnet-runtime-notices/runtime.json')
  ).productVersion
  const runtimeVersion = verifyRuntimeNotices(
    framework,
    noticeVersion
  )
  const destination = join(output, 'licenses')
  mkdirSync(destination, { recursive: true })
  const sections = []

  function include(source, target, title) {
    const text = read(source) // Missing notices must fail the production build.
    mkdirSync(resolve(destination, target, '..'), { recursive: true })
    cpSync(join(root, source), join(destination, target))
    sections.push({ title, target, text })
  }

  include('LICENSE', 'GPL-3.0.txt', 'pkCamp — GPL v3')
  include(
    'THIRD-PARTY-NOTICES.md',
    'THIRD-PARTY-NOTICES.md',
    'Credits and component licenses'
  )
  include(
    'src/services/guide/HEXMANIAC-ADVANCE-LICENSE.txt',
    'hexmaniac-advance/LICENSE.txt',
    'HexManiac Advance reference data — MIT'
  )
  include('MODIFICATIONS.md', 'MODIFICATIONS.md', 'pkCamp modifications')

  const vendors = [
    [
      'src/services/tradeDevice/vendor/gb-link-switch-ldn',
      'gb-link-switch-ldn',
    ],
    ['src/services/gbaSaveDump/vendor/gb-cart-doctor', 'gb-cart-doctor'],
    [
      'src/services/mysteryGift/vendor/gblink-wondercards',
      'gblink-wondercards',
    ],
    ['src/services/pokeTransporter/vendor', 'poke-transporter-gb'],
    ['src/services/tradeDevice/vendor/picoflash', 'picoflash'],
    ['vendor/dotnet-runtime-notices', 'dotnet-runtime'],
  ]
  for (const [source, name] of vendors) {
    for (const required of [
      'PROVENANCE.md',
      name === 'dotnet-runtime' ? 'LICENSE.txt' : 'LICENSE',
      ...(name === 'gb-cart-doctor' ? ['LICENSE.MIT'] : []),
      ...(name === 'dotnet-runtime' ? ['THIRD-PARTY-NOTICES.txt'] : []),
    ]) {
      if (!existsSync(join(root, source, required))) {
        throw new Error(`Missing required notice: ${source}/${required}`)
      }
    }
    for (const file of readdirSync(join(root, source))) {
      if (
        /^(LICENSE|PROVENANCE|THIRD-PARTY-NOTICES)(\.|$)/.test(file) ||
        (name === 'dotnet-runtime' && file === 'runtime.json')
      ) {
        include(`${source}/${file}`, `${name}/${file}`, `${name} — ${file}`)
      }
    }
  }
  include(
    'src/services/tradeDevice/vendor/gb-link-switch-ldn/cable/LICENSE.MPL-2.0',
    'mgba-ldn/LICENSE.MPL-2.0',
    'mGBA cable translator — MPL 2.0'
  )
  include(
    'public/ribbons/PROVENANCE.md',
    'ribbons/PROVENANCE.md',
    'Ribbon icon provenance'
  )
  include(
    'vendor/pkhex-wasm/src/PKHexWasm/Crypto/Vendored/LICENSE.md',
    'bouncycastle/LICENSE.md',
    'Bouncy Castle — MIT'
  )
  include(
    'vendor/pkhex-wasm/FORK_NOTES.md',
    'pkhex-wasm/FORK_NOTES.md',
    'WASM fork provenance'
  )
  for (const file of [
    'LICENSE',
    'THIRD-PARTY-NOTICES.md',
    'MODIFICATIONS.md',
    'upstream.json',
  ]) {
    include(
      `vendor/pkhex-wasm/dist/${file}`,
      `pkhex-wasm/${file}`,
      `pkhex-wasm — ${file}`
    )
  }

  // Preserve the notices of installed runtime dependencies, including transitive
  // dependencies. Resolve from the importer so nested npm installations work too.
  const visited = new Set()
  function dependency(name, parent) {
    let current = parent
    let directory
    while (current.startsWith(root)) {
      const candidate = join(current, 'node_modules', name)
      if (existsSync(join(candidate, 'package.json'))) {
        directory = candidate
        break
      }
      const next = resolve(current, '..')
      if (next === current) break
      current = next
    }
    if (!directory) throw new Error(`Missing runtime dependency: ${name}`)
    const metadata = JSON.parse(
      readFileSync(join(directory, 'package.json'), 'utf8')
    )
    const key = `${metadata.name}@${metadata.version}`
    if (visited.has(key)) return
    visited.add(key)
    const licenses = readdirSync(directory).filter((file) =>
      /^(LICEN[CS]E|COPYING|NOTICE)(\.|$)/i.test(file)
    )
    // @thenick775/mgba-wasm declares MPL-2.0 but its npm tarball omits the
    // license file. Package the identical MPL text already preserved for the
    // mGBA-derived cable component, while keeping the package's own title.
    if (!licenses.length && key === '@thenick775/mgba-wasm@2.5.1') {
      include(
        'src/services/tradeDevice/vendor/gb-link-switch-ldn/cable/LICENSE.MPL-2.0',
        `npm/${key}/LICENSE.MPL-2.0`,
        `${key} — MPL-2.0`
      )
    } else if (!licenses.length) {
      throw new Error(`No license text found for ${key}`)
    }
    for (const file of licenses) {
      const source = relative(root, join(directory, file))
      include(
        source,
        `npm/${key}/${file}`,
        `${key} — ${metadata.license ?? 'see license'}`
      )
    }
    for (const child of Object.keys(metadata.dependencies ?? {}))
      dependency(child, directory)
  }
  for (const name of Object.keys(
    JSON.parse(read('package.json')).dependencies
  )) {
    if (name !== 'pkhex-wasm') dependency(name, root)
  }

  const commit =
    process.env.GITHUB_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid build commit')
  const dirty =
    execFileSync('git', ['status', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    }).trim().length > 0
  const build = {
    commit,
    dirty,
    license: 'GPL-3.0-or-later',
    runtimeVersion,
    runtimeNoticeVersion: noticeVersion,
  }
  writeFileSync(
    join(destination, 'build.json'),
    JSON.stringify(build, null, 2) + '\n'
  )
  const sources = [
    ['pkCamp repository', 'https://github.com/MercuryEnigma/pkcamp'],
    [
      'pkCamp build commit',
      `https://github.com/MercuryEnigma/pkcamp/tree/${commit}`,
    ],
    [
      'PKHeX.Everywhere (pinned MIT revision)',
      'https://github.com/arleypadua/PKHeX.Everywhere/tree/c8836824d128152bfabb489daa18eb8e1493a201',
    ],
    [
      'PKHeX Core and ribbon sources',
      'https://github.com/arleypadua/PKHeX/tree/10016c6fe5b732a113c3ca732116ea8976dc1f2c',
    ],
    [
      'Cart Doctor ROM sources and build scripts',
      'https://github.com/GB-Link/gb-cart-doctor-web/tree/12aa211923add22a567e5c4310ebb45605cd49bf',
    ],
    [
      'gblink-wondercards source',
      'https://github.com/GB-Link/gblink-wondercards/tree/24d5b63c8f2c0609afa9497ed648a2bf173cae7a',
    ],
    [
      'GB-Link-Switch-LDN source',
      'https://github.com/GB-Link/GB-Link-Switch-LDN/tree/c1a3a97f3ab5c60e87307089d6b7db10e3fd5993',
    ],
    [
      'GB-Link-Switch-LDN gift source',
      'https://github.com/GB-Link/GB-Link-Switch-LDN/tree/8b47745dd2b8efcddb9ff93e4ad319eae4b95f25',
    ],
    [
      `.NET runtime ${runtimeVersion} source`,
      `https://github.com/dotnet/runtime/tree/v${runtimeVersion}`,
    ],
    [
      `.NET runtime ${runtimeVersion} third-party notices`,
      `https://github.com/dotnet/runtime/blob/v${runtimeVersion}/THIRD-PARTY-NOTICES.TXT`,
    ],
    [
      'Poké Transporter GB source',
      'https://github.com/Striaton-Lab-Team/Poke_Transporter_GB/tree/1.2.1',
    ],
    [
      'mGBA WASM source (pinned npm revision)',
      'https://github.com/thenick775/mgba/tree/e974b288bd7e5cfc7c7b96f8b4d32b673ddfb68c',
    ],
  ]
  writeFileSync(
    join(destination, 'SOURCES.md'),
    `# Source code\n\nBuild commit: ${commit}\n\n${dirty ? 'This build contains unpublished working-tree changes. Commit and publish before deploying.\n\n' : ''}${sources.map(([label, url]) => `- [${label}](${url})`).join('\n')}\n`
  )
  return sections.length
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = join(root, 'dist')
  const count = packageLicenses({
    output,
    framework: join(output, 'pkhex-wasm/wasm/_framework'),
  })
  console.log(
    `Packaged ${count} license notices and GitHub source links (no archives).`
  )
}
