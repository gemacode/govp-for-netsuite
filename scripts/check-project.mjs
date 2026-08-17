import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const required = ['src/manifest.xml','src/deploy.xml','src/Objects/customrecord_govp_job.xml','src/Objects/custbody_govp_reference.xml','src/Objects/customscript_govp_queue_ue.xml','src/Objects/customscript_govp_process_mr.xml'];
for (const path of required) assert((await readFile(new URL(path, root), 'utf8')).trim(), `Falta ${path}`);
const objects = await readdir(new URL('src/Objects/', root));
assert.equal(objects.filter(name => name.endsWith('.xml')).length, 4);
console.log('GOVP for NetSuite SDF project structure passed.');
