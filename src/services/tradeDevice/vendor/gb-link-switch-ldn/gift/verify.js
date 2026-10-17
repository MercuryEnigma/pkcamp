// The address check for ROMs whose addresses are predicted
// (cards/predict-roms.mjs): the Switch runs cards/verify.s, which looks for 4
// known bytes near each address a card or save script uses and reports how far
// from it they are. A ROM address found a few bytes off moves by as much in the
// script; a RAM address only has to be found.

import { EVENT_SYMBOLS, ROM_CHECKS, SAVE_SYMBOLS, VERIFY_COUNT, VERIFY_ENTRIES, VERIFY_SCRIPT } from './rom-checks.js';

const NOT_FOUND = 0x80;

const u32 = (bytes, at) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
const put32 = (bytes, at, value) => {
    bytes[at] = value & 0xff;
    bytes[at + 1] = (value >>> 8) & 0xff;
    bytes[at + 2] = (value >>> 16) & 0xff;
    bytes[at + 3] = (value >>> 24) & 0xff;
};

// The checks of `names` on the ROM, as { name, address, value, ram, offsets },
// or null when its addresses come from a build (nothing to check).
function checksFor(rom, names, offsets = () => []) {
    const checks = ROM_CHECKS[rom];
    if (!checks || !names?.length) return null;
    return names.map((name) => {
        const [address, value, ram = 0] = checks[name];
        return { name, address, value, ram: ram === 1, offsets: offsets(name) };
    });
}

// A team card's checks, with where its script holds each address.
export function eventChecks(rom, eventId) {
    const held = EVENT_SYMBOLS[eventId];
    if (!held) return null;
    const where = new Map(held);
    return checksFor(rom, held.map(([name]) => name), (name) => where.get(name));
}

// A save script's checks ('backup' or 'restore').
export function saveChecks(rom, kind) {
    return checksFor(rom, SAVE_SYMBOLS[kind]);
}

// cards/verify.s with the checks in its table.
export function verifyScript(checks) {
    if (checks.length > VERIFY_ENTRIES) throw new Error(`${checks.length} addresses to check, the check takes ${VERIFY_ENTRIES}.`);
    const bytes = new Uint8Array(VERIFY_COUNT + 4 + 8 * checks.length);
    bytes.set(VERIFY_SCRIPT.subarray(0, VERIFY_COUNT));
    put32(bytes, VERIFY_COUNT, checks.length);
    checks.forEach((check, i) => {
        put32(bytes, VERIFY_COUNT + 4 + 8 * i, check.address);
        put32(bytes, VERIFY_COUNT + 8 + 8 * i, check.value);
    });
    return bytes;
}

// The answer: each check's distance from its address, or null when not found.
export function readAnswer(answer, checks) {
    if (answer.length < checks.length) throw new Error('The Switch’s answer to the address check is too short.');
    return checks.map((check, i) => (answer[i] === NOT_FOUND ? null : (answer[i] << 24) >> 24));
}

// Which addresses weren't found, and which ROM ones were off by how much. With
// `exact`, a ROM address must be where predicted.
export function judge(checks, distances, { exact = false } = {}) {
    const missing = [];
    const moved = [];
    checks.forEach((check, i) => {
        const distance = distances[i];
        if (distance === null || (exact && !check.ram && distance !== 0)) missing.push(check.name);
        else if (!check.ram && distance !== 0) moved.push([check.name, distance]);
    });
    return { ok: missing.length === 0, missing, moved };
}

// The script with each ROM address found off its prediction moved by as much.
export function relocate(script, checks, distances) {
    const out = Uint8Array.from(script);
    checks.forEach((check, i) => {
        const distance = distances[i];
        if (check.ram || !distance) return;
        for (const at of check.offsets) put32(out, at, (u32(out, at) + distance) >>> 0);
    });
    return out;
}
