const RELOAD_KEY = 'pkcamp:arcade:isolation-reload'

/** False means a reload is underway; the caller must not mount the player. */
export async function enableIsolation(): Promise<boolean> {
  if (crossOriginIsolated) {
    sessionStorage.removeItem(RELOAD_KEY)
    return true
  }
  if (!('serviceWorker' in navigator)) return true
  await navigator.serviceWorker.register(
    `${import.meta.env.BASE_URL}arcade/isolation-sw.js`,
    { scope: `${import.meta.env.BASE_URL}arcade/` }
  )
  await navigator.serviceWorker.ready
  // clients.claim() can control the current page without its isolation
  // headers. Fetch the document through the worker once, even if controlled.
  if (sessionStorage.getItem(RELOAD_KEY)) return true
  sessionStorage.setItem(RELOAD_KEY, '1')
  window.location.reload()
  return false
}
