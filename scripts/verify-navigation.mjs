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
  const badge = page.getByRole('button', { name: /Open storage settings/ })
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
  await page.getByRole('button', { name: 'Save viewer', exact: true }).click()
  const upload = page.locator('input[type=file]').first()
  const save = {
    name: 'emerald.sav',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('fixture:emerald'),
  }
  await upload.setInputFiles(save)
  await page.getByRole('button', { name: 'Save Game', exact: true }).waitFor()
  const back = page.waitForEvent('dialog')
  const backClick = page
    .getByRole('button', { name: '← Back', exact: true })
    .click()
  const backDialog = await back
  assert.match(backDialog.message(), /unsaved changes/)
  await backDialog.dismiss()
  await backClick
  const corner = page.waitForEvent('dialog')
  const cornerClick = badge.click()
  await (await corner).dismiss()
  await cornerClick
  assert.equal(await page.getByTestId('opened').textContent(), '2')
  await page.getByRole('button', { name: 'Save Game', exact: true }).click()
  await page
    .getByRole('button', { name: 'Save Game', exact: true })
    .waitFor({ state: 'hidden' })
  await badge.click()
  assert.equal(await page.getByTestId('opened').textContent(), '3')
  assert.deepEqual(errors, [])
  const app = await browser.newPage()
  app.setDefaultTimeout(15000)
  await app.route('https://**/*', (route) => route.abort())
  await app.goto(base)
  await app.getByRole('button', { name: 'Start', exact: true }).click()
  await app.getByRole('button', { name: 'Continue', exact: true }).click()
  await app.getByRole('button', { name: /Camp Zone/ }).waitFor()
  await app.getByRole('button', { name: /Lab Zone/ }).click()
  await app.getByRole('button', { name: /Settings Backups/ }).click()
  await app.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await app.getByLabel('Sprite resource').selectOption('shuffle')
  const settingsPrompt = app.waitForEvent('dialog')
  const settingsBack = app
    .getByRole('button', { name: '← Back', exact: true })
    .click()
  const settingsDialog = await settingsPrompt
  assert.match(settingsDialog.message(), /unsaved settings/)
  await settingsDialog.dismiss()
  await settingsBack
  await app.getByRole('button', { name: 'Save Settings', exact: true }).click()
  await app.getByText('Settings saved.', { exact: true }).waitFor()
  await app.getByRole('button', { name: '← Back', exact: true }).click()
  await app.getByRole('heading', { name: "Celio's Lab", exact: true }).waitFor()
  console.log(
    'Passed: Dropbox edit/trade guards, hidden Lab scope, shared sprites, uploaded-save guards, and real-app settings/navigation.'
  )
} finally {
  await browser.close()
}
