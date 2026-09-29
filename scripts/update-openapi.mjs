// Refreshes the API snapshot the contract test checks every tool against.
import { writeFile } from 'node:fs/promises';

const base = (process.env.ARSEL_API_URL ?? 'https://api.arsel.sa/v1').replace(/\/+$/, '');
const url = `${base}/openapi.json`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`GET ${url} → ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
await writeFile(
  new URL('../openapi/arsel-api.json', import.meta.url),
  `${JSON.stringify(spec, null, 2)}\n`,
);
console.log(`Wrote openapi/arsel-api.json from ${url}. Run npm test to see what drifted.`);
