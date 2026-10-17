// The events the page sends, in the groups its list shows. Each holds payloads (a Wonder
// Card, padding, the RAM script) by ROM, 'BPRE 1.10' for the Switch's FireRed, or under
// `frlg` for any FireRed and LeafGreen; `roms`, when present, lists the only ROMs it runs on.

import { DISTRIBUTION_EVENTS, PROJECT_WONDER_EVENTS } from './official.js';
import { TEAM_EVENTS } from './team.js';
import { SAVE_EVENTS } from './save-backup.js';
import { RESTORE_EVENTS } from './save-restore.js';
import { PAYLOAD_SCRIPT_OFFSET, WONDER_CARD_BYTES, gameOfCode, romId } from './mystery-gift.js';
import { eventChecks } from './verify.js';

export const EVENT_GROUPS = [
    { label: 'Event distributions', events: DISTRIBUTION_EVENTS },
    { label: 'Project Wonder (Goppier)', events: PROJECT_WONDER_EVENTS },
    { label: 'GB-Link Team', events: TEAM_EVENTS },
    { label: 'Your save', events: [...SAVE_EVENTS, ...RESTORE_EVENTS] },
];

export const EVENTS = EVENT_GROUPS.flatMap((group) => group.events);

export function findEvent(id) {
    return EVENTS.find((event) => event.id === id) ?? null;
}

// The event's payloads for the game the Switch reports, as { card, script,
// checks }; `checks` (verify.js) only where the ROM's addresses are predicted.
export function eventPayloads(event, game) {
    const rom = romId(game);
    if (event.roms && !event.roms.includes(rom)) return [];
    const own = event.payloads[rom];
    const all = own ?? (gameOfCode(game.gameCode) === 'frlg' ? event.payloads.frlg : null) ?? [];
    const checks = own ? eventChecks(rom, event.id) : null;
    return all.map((bytes) => ({
        card: bytes.subarray(0, WONDER_CARD_BYTES),
        script: bytes.subarray(PAYLOAD_SCRIPT_OFFSET),
        checks,
    }));
}

// The one to send: one of them at random, as the egg cartridges pick a species for each
// delivery. Null when none runs there.
export function eventPayload(event, game, random = Math.random) {
    const payloads = eventPayloads(event, game);
    return payloads.length ? payloads[Math.floor(random() * payloads.length)] : null;
}
