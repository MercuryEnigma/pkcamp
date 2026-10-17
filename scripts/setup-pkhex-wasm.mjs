import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const project = fileURLToPath(new URL('../', import.meta.url))
const external = join(project, 'vendor/pkhex-wasm/external')
const everywhere = join(external, 'PKHeX.Everywhere')
const core = join(everywhere, 'external/PKHeX')
const everywherePin = 'c8836824d128152bfabb489daa18eb8e1493a201'
const corePin = '10016c6fe5b732a113c3ca732116ea8976dc1f2c'

function run(command, args, cwd = project) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status})`)
}
function revision(cwd) {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`Cannot read revision in ${cwd}`)
  return result.stdout.trim()
}

mkdirSync(external, { recursive: true })
if (!existsSync(everywhere)) {
  run('git', [
    'clone',
    '--filter=blob:none',
    '--no-checkout',
    'https://github.com/arleypadua/PKHeX.Everywhere.git',
    everywhere,
  ])
  run('git', ['checkout', everywherePin], everywhere)
}
// Existing checkouts must already match. Never reset a developer's work.
if (revision(everywhere) !== everywherePin)
  throw new Error(`PKHeX.Everywhere must be at ${everywherePin}`)
if (!existsSync(join(core, '.git'))) {
  run(
    'git',
    ['submodule', 'update', '--init', '--filter=blob:none', 'external/PKHeX'],
    everywhere
  )
}
if (revision(core) !== corePin) throw new Error(`PKHeX must be at ${corePin}`)

// Local additions to upstream sources (see vendor/pkhex-wasm/overlays/README.md).
// Idempotent: safe to re-run on an already-patched checkout.
const overlays = join(project, 'vendor/pkhex-wasm/overlays/PKHeX.Everywhere')
cpSync(overlays, everywhere, { recursive: true })
const pokemonCs = join(everywhere, 'src/PKHeX.Facade/Pokemons/Pokemon.cs')
const anchor = /^( *)public Egg Egg => new\(pokemon\);(\r?\n)/m
const source = readFileSync(pokemonCs, 'utf8')
if (!source.includes('public Ribbons Ribbons => new(pokemon);')) {
  if (!anchor.test(source))
    throw new Error(`Cannot find the Egg property in ${pokemonCs} to add Ribbons after it`)
  writeFileSync(
    pokemonCs,
    source.replace(anchor, (line, indent, eol) => `${line}${indent}public Ribbons Ribbons => new(pokemon);${eol}`),
  )
}

run('npm', ['run', 'build:pkhex-wasm'])
