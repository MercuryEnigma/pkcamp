import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const presentationAttributes = new Set([
  'aria-label',
  'aria-description',
  'aria-valuetext',
  'aria-roledescription',
  'alt',
  'title',
  'placeholder',
  'label',
  'description',
  'page',
  'kicker',
  'progressLabel',
  'startLabel',
  'emptyMessage',
  'saveStatus',
  'romStatus',
  'note',
  'steps',
  'afterStartSteps',
  'caption',
])

// Exact exceptions only. These are product names or literal hardware labels,
// not a general exemption for capitalized words or short UI strings.
const exceptions = new Map([
  ['pkcamp', 'Product wordmark'],
  ['pkCamp', 'Product name'],
  ['PK Camp', 'Legacy product name'],
  ['Pokémon', 'Game terminology retained in this migration'],
  ['PKHeX', 'Project name'],
  ['pkhex-wasm', 'Project name'],
  ['GB-Link', 'Hardware/project name'],
  ['GB-Link Cart Doctor', 'Project name'],
  ['ESP32', 'Hardware name'],
  ['ESP32 board', 'Hardware name'],
  ['Switch', 'Console name'],
  ['Game Boy Advance', 'Console name'],
  ['GBA', 'Console abbreviation'],
  ['ROM', 'File-format abbreviation'],
  ['PC', 'In-game device name'],
  ['A', 'Controller button'],
  ['B', 'Controller button'],
  ['L', 'Controller button'],
  ['R', 'Controller button'],
])

function textCopy(value) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return /\p{L}/u.test(normalized) && !exceptions.has(normalized)
}

/** Inspect JSX text and literals in presentation expressions without executing code. */
export function findHardcodedCopy(source, filename = 'screen.tsx') {
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const violations = []
  function report(node, text) {
    if (!textCopy(text)) return
    const { line, character } = ast.getLineAndCharacterOfPosition(
      node.getStart(ast)
    )
    violations.push({
      file: filename,
      line: line + 1,
      column: character + 1,
      text: text.trim(),
    })
  }
  function expression(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      report(node, node.text)
      return
    }
    if (ts.isTemplateExpression(node)) {
      report(
        node,
        [
          node.head.text,
          ...node.templateSpans.map((span) => span.literal.text),
        ].join(' ')
      )
      return
    }
    // Call arguments, identifiers, conditions and event handlers can carry
    // machine values. Their rendered JSX is still inspected by the main walk.
    if (
      ts.isCallExpression(node) ||
      ts.isFunctionLike(node) ||
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    )
      return
    if (ts.isConditionalExpression(node)) {
      expression(node.whenTrue)
      expression(node.whenFalse)
      return
    }
    if (ts.isBinaryExpression(node)) {
      if (
        [
          ts.SyntaxKind.AmpersandAmpersandToken,
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
        ].includes(node.operatorToken.kind)
      )
        expression(node.right)
      return
    }
    ts.forEachChild(node, expression)
  }
  function walk(node) {
    if (ts.isJsxText(node)) report(node, node.text)
    if (
      ts.isJsxAttribute(node) &&
      (presentationAttributes.has(node.name.getText(ast)) ||
        (node.name.getText(ast) === 'name' &&
          ts.isJsxAttributes(node.parent) &&
          ['TradeSidePanel', 'BoxNav'].includes(
            node.parent.parent.tagName.getText(ast)
          ))) &&
      node.initializer
    )
      expression(node.initializer)
    if (
      ts.isJsxExpression(node) &&
      !ts.isJsxAttribute(node.parent) &&
      node.expression
    )
      expression(node.expression)
    ts.forEachChild(node, walk)
  }
  walk(ast)
  return violations
}

export function checkFiles(root = 'src') {
  return fs
    .readdirSync(root, { recursive: true })
    .filter(
      (file) =>
        file.endsWith('.tsx') &&
        !/(^|\/)(vendor|generated)\/|\.(test|spec)\.tsx$/.test(file)
    )
    .flatMap((file) => {
      const filename = path.join(root, file)
      return findHardcodedCopy(fs.readFileSync(filename, 'utf8'), filename)
    })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const violations = checkFiles()
  for (const entry of violations)
    console.error(
      `${entry.file}:${entry.line}:${entry.column}: Untranslated UI copy: ${JSON.stringify(entry.text)}`
    )
  if (violations.length) process.exitCode = 1
  else
    console.log('PASS: JSX copy and presentation attributes use i18n catalogs.')
}
