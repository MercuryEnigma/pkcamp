# Arcade coordination

Implementation and review history is archived in
[the October handoff](../../../../docs/archive/ARCADE_COORDINATION_2026-10.md).

The release implementation uses `ArcadePlayer`, the controller skin
renderer (`skins/delta/`), and `services/emulator/mgbaRuntime`. UI is split
into the player, menu, confirmation dialogs, input hook, and skin loader. Shared save synchronization
remains in `arcadeSync.ts`.

Current requirements and outstanding device/deployment checks are tracked in
[the plan](../../../../docs/ARCADE_ZONE_PLAN.md),
[the site roadmap](../../../../ROADMAP.md#arcade-zone), and
[runtime evidence](../../../../docs/ARCADE_RUNTIME.md).

Do not commit private ROMs, saves, or browser-generated output.
