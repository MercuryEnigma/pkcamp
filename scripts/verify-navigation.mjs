import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const base = process.env.PKCAMP_TEST_URL ?? 'http://127.0.0.1:5174/pkcamp/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(new URL('tests/browser/navigation.html', base).href)
  const badge = page
    .getByRole('button', { name: /Open storage settings/ })
    .first()
  for (const [mode, message] of [
    ['Dirty editor', 'Unsaved edits'],
    ['Active trade', 'Active trade'],
  ]) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    const denied = page.waitForEvent('dialog')
    const click = badge.click()
    const dialog = await denied
    assert.equal(dialog.message(), message)
    await dialog.dismiss()
    await click
    assert.equal(await page.getByTestId('opened').textContent(), '0')
  }
  await page.getByRole('button', { name: 'Active trade', exact: true }).click()
  const approved = page.waitForEvent('dialog')
  const approveClick = badge.click()
  await (await approved).accept()
  await approveClick
  assert.equal(await page.getByTestId('opened').textContent(), '1')
  await page.getByRole('button', { name: 'Hidden Lab', exact: true }).click()
  await badge.click()
  assert.equal(await page.getByTestId('opened').textContent(), '2')
  await page
    .getByRole('button', { name: 'Change shared sprites', exact: true })
    .click()
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="sprite-a"]').textContent ===
      'shuffle'
  )
  assert.equal(
    await page.getByTestId('sprite-a').textContent(),
    await page.getByTestId('sprite-b').textContent()
  )
  // Current Camp drafts use the active-game service; the former SaveViewer
  // component no longer exists. Retain upload/edit/save guard coverage here.
  await page.getByRole('button', { name: 'Save viewer', exact: true }).click()
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'emerald.sav',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('fixture:emerald'),
    })
  await page.getByRole('button', { name: 'Save', exact: true }).waitFor()
  const draftPrompt = page.waitForEvent('dialog')
  const draftBack = page
    .getByTestId('draft-camp')
    .getByRole('button', { name: 'Back', exact: true })
    .click()
  const draftDialog = await draftPrompt
  assert.match(draftDialog.message(), /unsaved changes/)
  await draftDialog.dismiss()
  await draftBack
  const badgePrompt = page.waitForEvent('dialog')
  const badgeClick = badge.click()
  await (await badgePrompt).dismiss()
  await badgeClick
  assert.equal(await page.getByTestId('opened').textContent(), '2')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save', exact: true })
    .waitFor({ state: 'hidden' })
  await badge.click()
  assert.equal(await page.getByTestId('opened').textContent(), '3')
  assert.deepEqual(errors, [])
  const app = await browser.newPage()
  app.setDefaultTimeout(15000)
  app.on('pageerror', (error) => errors.push(error.message))
  await app.route('https://**/*', (route) => route.abort())
  await app.goto(base)
  // The header exposes only bundled languages and remembers the selection.
  for (const width of [1280, 375, 320]) {
    await app.setViewportSize({ width, height: 800 })
    const language = app.getByRole('button', { name: 'Language', exact: true })
    await language.click()
    const languageDialog = app.getByRole('menu', {
      name: 'Language',
      exact: true,
    })
    await languageDialog.waitFor()
    assert.deepEqual(
      await languageDialog.getByRole('menuitemradio').allTextContents(),
      ['English']
    )
    assert.equal(
      await language.locator('.camp-language-code').textContent(),
      'EN'
    )
    await languageDialog
      .getByRole('menuitemradio', { name: 'English', exact: true })
      .click()
    assert.equal(
      await app.evaluate(() => localStorage.getItem('pkcamp.language')),
      'en'
    )
    await languageDialog.waitFor({ state: 'hidden' })
    await language.click()
    await app.keyboard.press('Escape')
    await languageDialog.waitFor({ state: 'hidden' })
    assert.equal(
      await language.evaluate((element) => element === document.activeElement),
      true
    )
    const badges = await app
      .locator('.site-start-actions .camp-dropbox-badge')
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right }
        })
      )
    assert.equal(badges.length, 3)
    for (let i = 0; i < badges.length; i++) {
      assert.ok(badges[i].left >= 0 && badges[i].right <= width)
      if (i) assert.ok(badges[i - 1].right <= badges[i].left)
    }
  }
  await app.setViewportSize({ width: 1280, height: 800 })
  await app.reload()
  await app
    .getByRole('button', { name: 'Continue to the campsite', exact: true })
    .click()
  await app.getByRole('button', { name: 'Continue', exact: true }).click()
  await app.getByRole('button', { name: /^Camp / }).waitFor()
  await app.getByRole('button', { name: /^Lab / }).click()
  await app.getByRole('button', { name: /^Settings / }).click()
  await app.getByRole('button', { name: 'Appearance', exact: true }).click()
  await app.getByLabel('Sprite resource').selectOption('shuffle')
  const settingsPrompt = app.waitForEvent('dialog')
  const settingsBack = app
    .getByRole('button', { name: 'Back', exact: true })
    .click()
  const settingsDialog = await settingsPrompt
  assert.match(settingsDialog.message(), /unsaved settings/)
  await settingsDialog.dismiss()
  await settingsBack
  await app.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await app.getByText('Settings saved.', { exact: true }).waitFor()
  await app.getByRole('button', { name: 'Back', exact: true }).click()
  await app.getByRole('heading', { name: 'Lab', exact: true }).waitFor()
  const translations = await app.evaluate(async (baseHref) => {
    const { i18n } = await import(
      new URL('src/services/i18n/index.ts', baseHref).href
    )
    return {
      language: i18n.language,
      pokemon: i18n.t('areas.pokemon'),
      fallback: i18n.t('areas.pokemon', { lng: 'unknown' }),
      news: i18n.t('news:heading'),
    }
  }, base)
  assert.deepEqual(translations, {
    language: 'en',
    pokemon: 'Pokémon',
    fallback: 'Pokémon',
    news: 'News & Updates',
  })
  await app.getByRole('button', { name: 'Patch Notes', exact: true }).click()
  await app
    .getByRole('heading', {
      name: 'Mystery Gift live at Pokémon Worlds / XP!',
      exact: true,
    })
    .waitFor()
  await app.goto(new URL('lab/?mode=collection', base).href)
  await app
    .getByRole('heading', { name: 'Pokédex research system', exact: true })
    .waitFor()
  await app
    .getByRole('button', { name: '+ New collection', exact: true })
    .click()
  await app.getByLabel('Name *', { exact: true }).waitFor()
  for (const [mode, title] of [
    ['tools', 'Research Tools'],
    ['transporter', 'Transporter'],
    ['gifts', 'Mystery Gifts'],
    ['saves', 'Cartridge Saves'],
    ['dumps', 'ROM / BIOS Dumps'],
  ]) {
    await app.goto(new URL(`lab/?mode=${mode}`, base).href)
    await app.getByRole('heading', { name: title, exact: true }).waitFor()
    assert.doesNotMatch(
      await app.locator('body').innerText(),
      /\{\{|(?:common|start|hub|camp|lab|collections|services|settings|arcade):[A-Za-z]+\./
    )
  }
  await app.goto(new URL('lab/?mode=transporter', base).href)
  await app.getByRole('button', { name: 'Language', exact: true }).click()
  const spanishOption = app.getByRole('menuitemradio', {
    name: 'Español',
    exact: true,
  })
  if (await spanishOption.count()) {
    await app
      .getByRole('menuitemradio', { name: 'Español', exact: true })
      .click()
    await app
      .getByRole('heading', { name: 'Transportador', exact: true })
      .waitFor()
    const spanishWarning =
      'Los Pokémon transferidos se eliminan del juego de origen. Se modificarán ambas partidas guardadas. Usa cartuchos originales: las copias no oficiales pueden provocar la pérdida de Pokémon.'
    await app.getByText(spanishWarning, { exact: true }).waitFor()
    await app.getByRole('button', { name: /Enviar a la GBA/ }).click()
    await app
      .getByText('Inserta el juego de GBA que recibirá tus Pokémon.', {
        exact: true,
      })
      .waitFor()
    await app.getByRole('button', { name: /En las consolas/ }).click()
    await app
      .getByText(
        'Mantén encendida la GBA que está ejecutando Poké Transporter.',
        { exact: true }
      )
      .waitFor()
    for (const [mode, title] of [
      ['tools', 'Herramientas de investigación'],
      ['gifts', 'Regalos misteriosos'],
      ['saves', 'Partidas de cartuchos'],
      ['dumps', 'Extracción de ROM / BIOS'],
      ['settings', 'Ajustes'],
    ]) {
      await app.goto(new URL(`lab/?mode=${mode}`, base).href)
      await app.getByRole('heading', { name: title, exact: true }).waitFor()
      assert.doesNotMatch(
        await app.locator('body').innerText(),
        /\{\{|Moved Pokémon|Insert el|Atrás up|Tú need|Keep el|Reading el|could not|will receive/
      )
    }
  } else {
    assert.deepEqual(await app.getByRole('menuitemradio').allTextContents(), [
      'English',
    ])
    await app.keyboard.press('Escape')
  }
  assert.deepEqual(errors, [])
  console.log(
    'Passed: Dropbox edit/trade guards, hidden Lab scope, shared sprites, Camp draft guards, real-app settings/navigation, responsive language selection, shared i18n, Patch Notes, collection builder, all research tools, and enabled language options.'
  )
} finally {
  await browser.close()
}
