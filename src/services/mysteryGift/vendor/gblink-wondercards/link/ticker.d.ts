/** Calls `onTick` at the GBA's frame rate; returns a function that stops it. */
export function startTicker(onTick: () => void): () => void
