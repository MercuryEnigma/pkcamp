/**
 * The very first thing a player sees before the Camp Zone menu -- a single
 * full-screen tap target, not a button buried in a layout, since the only
 * action here is "start."
 */
export function Splash({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="camp-root camp-splash" onClick={onStart}>
      <div className="camp-content camp-splash-content">
        <p className="camp-eyebrow">PkCamp</p>
        <h1 className="camp-splash-title">Camp Zone</h1>
        <br />
        <p className="camp-splash-tap">Tap to start</p>
      </div>
    </button>
  )
}
