import { chromium } from 'playwright'
import path from 'node:path'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
page.on('pageerror', (err) => console.log('PAGEERROR:', err.message))
await page.goto('http://localhost:5186/pkcamp/')
await page.waitForTimeout(500)
await page.click('text=Start')
await page.waitForTimeout(300)
await page.click('text=Camp Zone: Manage your Pokemon')
await page.waitForTimeout(500)
await page.click('text=My Pokémon')
await page.waitForTimeout(500)
await page.click('text=GBA Era')
await page.waitForTimeout(500)
await page.click('text=Camping Pokémon')
await page.waitForTimeout(800)

await page.screenshot({ path: 'local-1-empty.png' })

const fileInput = page.locator('input[type=file]')
await fileInput.setInputFiles(path.resolve('src/assets/saves/ribbondol.pk3'))
await page.waitForTimeout(800)
await page.screenshot({ path: 'local-2-after-import.png' })

const bodyTextAfterImport = await page.textContent('body')
console.log('HAS_UNSAVED_AFTER_IMPORT:', bodyTextAfterImport.includes('unsaved changes'))

const idbAfterImport = await page.evaluate(() => {
  return new Promise((resolve) => {
    const req = indexedDB.open('pkcamp-local-pokemon')
    req.onsuccess = () => {
      const db = req.result
      const names = Array.from(db.objectStoreNames)
      if (names.length === 0) { resolve('no-stores'); return }
      const tx = db.transaction(names, 'readonly')
      const store = tx.objectStore(names[0])
      const getAll = store.getAll()
      getAll.onsuccess = () => resolve({ store: names[0], count: getAll.result.length })
    }
    req.onerror = () => resolve('error')
  })
})
console.log('IDB_BEFORE_SAVE:', JSON.stringify(idbAfterImport))

await page.click('text=Save Camping Pokémon')
await page.waitForTimeout(800)
await page.screenshot({ path: 'local-3-after-save.png' })
const bodyTextAfterSave = await page.textContent('body')
console.log('HAS_UNSAVED_AFTER_SAVE:', bodyTextAfterSave.includes('unsaved changes'))

const idbAfterSave = await page.evaluate(() => {
  return new Promise((resolve) => {
    const req = indexedDB.open('pkcamp-local-pokemon')
    req.onsuccess = () => {
      const db = req.result
      const names = Array.from(db.objectStoreNames)
      const tx = db.transaction(names, 'readonly')
      const store = tx.objectStore(names[0])
      const getAll = store.getAll()
      getAll.onsuccess = () => resolve({ store: names[0], count: getAll.result.length })
    }
    req.onerror = () => resolve('error')
  })
})
console.log('IDB_AFTER_SAVE:', JSON.stringify(idbAfterSave))

await browser.close()
