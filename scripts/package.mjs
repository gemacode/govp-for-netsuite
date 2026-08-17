import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';

const version = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const dist = new URL('../dist/', import.meta.url);
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
execFileSync('git', ['archive', '--format=zip', `--output=dist/govp-for-netsuite-${version}-source.zip`, 'HEAD'], { cwd: new URL('../', import.meta.url) });
console.log(`Created dist/govp-for-netsuite-${version}-source.zip`);
