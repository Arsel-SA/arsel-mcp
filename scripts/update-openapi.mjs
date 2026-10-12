// Refreshes the API snapshot the contract test checks every tool against.
import { readFile, writeFile } from 'node:fs/promises';

const base = (process.env.ARSEL_API_URL ?? 'https://api.arsel.sa/v1').replace(/\/+$/, '');
const url = `${base}/openapi.json`;
const snapshot = new URL('../openapi/arsel-api.json', import.meta.url);

const res = await fetch(url);
if (!res.ok) {
  console.error(`GET ${url} → ${res.status}`);
  process.exit(1);
}

// The API does not emit keys in a stable order, so keep the snapshot's: the diff then shows only what changed.
const ordered = (next, prev) => {
  if (Array.isArray(next)) {
    return next.map((value, i) => ordered(value, Array.isArray(prev) ? prev[i] : undefined));
  }
  if (!next || typeof next !== 'object') return next;
  const known = prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
  const keys = [
    ...Object.keys(known).filter((key) => key in next),
    ...Object.keys(next).filter((key) => !(key in known)),
  ];
  return Object.fromEntries(keys.map((key) => [key, ordered(next[key], known[key])]));
};

const previous = await readFile(snapshot, 'utf8').then(JSON.parse, () => ({}));
const spec = ordered(await res.json(), previous);
await writeFile(snapshot, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote openapi/arsel-api.json from ${url}. Run npm test to see what drifted.`);
