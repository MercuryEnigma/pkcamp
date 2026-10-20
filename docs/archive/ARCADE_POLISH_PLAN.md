# Arcade player polish plan

**Status: implemented October 2026; archived.** The shipped player uses a flat
cabinet in Camp's palette rather than the gold/navy treatment described in
section 1. Current scope is in [the plan](../ARCADE_ZONE_PLAN.md) and open
work in [the roadmap](../ARCADE_ZONE_ROADMAP.md).

Refine the existing player around a Pokémon Stadium Doduo Tower-inspired
arcade layout. Keep pkCamp's own visual language and assets; remove the
Poké Ball wallpaper rather than reproducing the reference screen.

The player must be understandable to a child without instructions. Playing is
the default; settings and file management stay out of the way.

## 1. Rebalance the player

- Make the 3:2 game screen the dominant element, targeting roughly 70–80% of
  the usable desktop width and all available height above the controls.
- Replace the oversized patterned frame with a compact gold/amber cabinet:
  dark navy screen surround, strong beveled edges, small version label, and
  restrained Stadium-style geometric accents.
- Reduce the controller deck height and width. Size controls from their input
  role instead of stretching them across the container: compact D-pad,
  circular A/B, short L/R shoulders, and small Start/Select/Menu pills.
- Use one cohesive button treatment with clear normal, pressed, focused, and
  disabled states. Keep version color as an accent instead of a second style.
- Desktop places the compact controls immediately below the large screen.
  Phone portrait keeps screen above controls; short landscape puts controls at
  the sides without shrinking the screen unnecessarily. Preserve 44px targets,
  safe areas, simultaneous touch, and no page overflow.

## 2. Replace the menu hierarchy

- Use a compact pause panel modeled on an in-game Stadium menu rather than a
  long settings form. Its first view has only `Keep playing`, `Sound`,
  `Controls`, and `Exit Arcade`, plus a plain save message.
- Put volume and speed under Sound and key mapping under Controls. Put Reset,
  ROM/SAV tools, downloads, and diagnostics behind a clearly separated
  `Advanced` section intended for an adult or experienced player.
- Use familiar words, large single-purpose rows, and short descriptions only
  where an action may lose progress. Avoid technical terms such as provider,
  callback, snapshot, or commit in user-facing copy.
- Never show a disabled action without explaining what the child should do
  next. Prefer messages such as `Save inside the game first`.
- Keep keyboard remapping in Controls, with current bindings visible before the
  user opens it. Menu navigation must work with touch, mouse, and keyboard.

## 3. Auto-sync in-game saves to Camp

- Treat each complete, settled mGBA save callback as a request to update the
  active session's captured storage provider. Remove the normal need for a
  separate “Save to Cabin” click.
- Serialize writes and coalesce callbacks so an older cloud write cannot win
  over a newer save. Keep the newest validated bytes until storage confirms
  them, then update the shared storage cache/event path used by Cabin and Lab.
- Preserve the current baseline conflict check. On a changed Cabin save, pause
  auto-sync and retain the Arcade bytes for Retry or Download SAV rather than
  overwriting either copy.
- Preserve the imported-SAV boundary: a locally loaded SAV cannot auto-sync
  until the game rewrites it and the settled callback passes structural checks.
- Show small persistent states near the screen: `Saving…`, `Saved!`, and
  `Could not save — Try again`. Keep detailed failure and conflict choices in
  the menu's Advanced section. Include the last successful sync time there.

## 4. Make leaving explicit

- Back, browser navigation, reset, ROM/SAV replacement, and provider changes
  consult one session state machine.
- While a game is running, Back pauses and asks `Did you save inside the game?`
  Offer the large choices `Keep playing` and `Exit Arcade` and show whether the
  latest in-game save reached Camp.
- If a save is pending, failed, or conflicted, make Retry and Download SAV
  available in that dialog and warn precisely what would be lost. Never perform
  an async write during `beforeunload`.
- After auto-sync succeeds, exiting may proceed after the informational prompt;
  a clean stopped session can leave directly.

## 5. Build and verify

- First extract and test a pure session-sync state reducer: callback, queued
  write, success, failure, conflict, retry, provider change, and exit decision.
- Integrate serialized auto-sync through the existing shared storage wrapper,
  then replace the menu structure, and finally tune responsive CSS.
- Add browser checks at 320×568, 390×844, 768×1024, 1440×900, and short
  landscape sizes. Assert screen-to-controls proportions, 3:2 display, 44px
  targets, no overlap/overflow, and understandable menu focus order.
- Verify local and Dropbox save callbacks, rapid consecutive saves, failures,
  conflicts, imported SAVs, return to Cabin, and Lab refresh. Repeat the final
  flow on real iOS Safari and Android Chrome.

Done means the screen visually dominates every supported layout, controls read
as one compact arcade controller, a child can start, pause, adjust sound, and
leave without help or scrolling, and a successful in-game save appears in Camp
without another save button.
