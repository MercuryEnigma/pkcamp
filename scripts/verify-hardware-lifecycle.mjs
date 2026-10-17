import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// Run against `npm run dev`. All hardware boundaries are simulated; the real
// pages and navigation guards run in Chrome, including late async completions.
const base = process.env.PKCAMP_TEST_URL ?? 'http://127.0.0.1:5173/pkcamp/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/src/services/tradeDevice/index.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const gbLinkTradeDevice = {
      state: 'disconnected', supported: true,
      connect: () => new Promise(resolve => { window.chooseDevice = resolve }),
      disconnect: async () => { window.disconnects = (window.disconnects || 0) + 1 }
    };`,
    })
  )
  for (const name of ['gbaGift', 'switchGift']) {
    await page.route(`**/src/services/mysteryGift/${name}.ts*`, (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `export function ${name === 'gbaGift' ? 'openGbaGift' : 'openSwitchGift'}(id, handlers, options) {
        window.giftHandlers = handlers;
        window.giftSignal = options.signal;
        return new Promise(resolve => { window.openGift = () => resolve({
          setGift() {}, decide() {},
          stop: async () => { window.stops++; if (window.failStop) throw new Error('Simulated stop failure') }
        }) });
      }`,
      })
    )
  }
  await page.route('**/hardware-lifecycle', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<div id="root"></div>
      <script type="module">
      import RefreshRuntime from '${base}@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      </script>
      <script type="module">
      import React, {useState} from '${base}node_modules/.vite/deps/react.js';
      import {createRoot} from '${base}node_modules/.vite/deps/react-dom_client.js';
      import {NavigationProvider} from '${base}src/pages/context/NavigationProvider.tsx';
      import {useConfirmNavigation} from '${base}src/pages/pokestorage/navigationGuard.ts';
      import {GbLinkTaskPanel} from '${base}src/pages/pokestorage/GbLinkTaskPanel.tsx';
      import {MysteryGifts} from '${base}src/pages/pokestorage/lab/MysteryGifts.tsx';
      window.stops=0; window.runs=0;
      const h=React.createElement;
      function Harness() {
        const [screen,setScreen]=useState('home');
        const confirm=useConfirmNavigation();
        const leave=()=>{if(confirm())setScreen('home')};
        return h(React.Fragment,null,
          h('button',{onClick:()=>setScreen('task')},'Show task'),
          h('button',{onClick:()=>setScreen('gifts')},'Show gifts'),
          h('button',{onClick:leave},'Leave'),
          screen==='home'?h('p',null,'Home'):screen==='gifts'?h(MysteryGifts,{onBack:()=>setScreen('home')}):
          h(GbLinkTaskPanel,{title:'Test task',steps:[],progressLabel:'Reading',onClose:()=>setScreen('home'),
            run:()=>{window.runs++;return new Promise(resolve=>{window.finishTask=resolve})},
            describeError:(_,cancelled)=>cancelled?'Cancelled.':'Failed.'}));
      }
      createRoot(document.getElementById('root')).render(h(NavigationProvider,null,h(Harness)));
      </script>`,
    })
  )
  await page.goto(new URL('hardware-lifecycle', base).href)
  const button = (name) => page.getByRole('button', { name, exact: true })
  async function leave(accept) {
    const dialog = page.waitForEvent('dialog')
    const click = button('Leave').click()
    const warning = await dialog
    if (accept) await warning.accept()
    else await warning.dismiss()
    await click
  }
  async function check(predicate) {
    await page.waitForFunction(predicate)
  }

  await button('Show task').click()
  await button('Start').click()
  await leave(false)
  assert.equal(await button('Cancel').count(), 1)
  await button('Cancel').click()
  await page.evaluate(() => window.chooseDevice())
  await page.getByText('Cancelled.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.runs), 0)
  await button('Start').click()
  await page.evaluate(() => window.chooseDevice())
  await check(() => window.runs === 1)
  await button('Cancel').click()
  await page.evaluate(() => window.finishTask('Late success'))
  await page.getByText('Cancelled.', { exact: true }).waitFor()
  assert.equal(await page.getByText('Late success', { exact: true }).count(), 0)
  await button('Start').click()
  await leave(true)
  await page.evaluate(() => window.chooseDevice())
  await page.getByText('Home', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.runs), 1)

  await button('Show gifts').click()
  await button('Start').click()
  await leave(false)
  await button('Cancel').click()
  assert.equal(await page.evaluate(() => window.giftSignal.aborted), true)
  await page.evaluate(() => window.openGift())
  await page.getByText('Cancelled.', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.stops), 1)

  await button('Start').click()
  await leave(true)
  await page.evaluate(() => window.openGift())
  await check(() => window.stops === 2)
  await page.evaluate(() => window.giftHandlers.onStatus({ stage: 'open' }))
  await page.getByText('Home', { exact: true }).waitFor()
  assert.equal(await button('Stop').count(), 0)

  await button('Show gifts').click()
  await button('Start').click()
  await page.evaluate(() => window.openGift())
  await button('Stop').waitFor()
  await page.evaluate(() => {
    window.failStop = true
  })
  await button('Stop').click()
  await page.getByText('Simulated stop failure', { exact: true }).waitFor()
  await button('Start').waitFor({ state: 'visible' })
  await page.evaluate(() =>
    window.giftHandlers.onFailed(new Error('Late failure'))
  )
  assert.equal(
    await page.getByText('Stopped: Late failure', { exact: true }).count(),
    0
  )
  assert.deepEqual(errors, [])
  console.log(
    'Hardware lifecycle: cancellation, navigation veto/accept, late chooser/results, gift shutdown and stop failure passed.'
  )
} finally {
  await browser.close()
}
