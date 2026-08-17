import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('el manifest declara un SuiteApp', async () => assert.match(await read('src/manifest.xml'), /projecttype="SUITEAPP"/));
test('la versión del paquete coincide con el manifest', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const manifest = await read('src/manifest.xml');
  assert.match(manifest, new RegExp(`<projectversion>${pkg.version.replaceAll('.', '\\.') }<\\/projectversion>`));
});
test('Item Fulfillment e Item Receipt tienen deployments separados', async () => {
  const xml = await read('src/Objects/customscript_govp_queue_ue.xml');
  assert.match(xml, /ITEMFULFILLMENT/); assert.match(xml, /ITEMRECEIPT/);
});
test('Map Reduce usa API Secret y no contiene token', async () => {
  const js = await read('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_process_mr.js');
  assert.match(js, /credentials: \[config\.secretId\]/); assert.match(js, /custsecret_/); assert.doesNotMatch(js, /ghp_|Bearer [A-Za-z0-9_-]{20,}/);
});
test('emisión usa plataforma e idempotencia contractuales', async () => {
  const js = await read('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_process_mr.js');
  for (const value of ['/connectors/issue', "platform: 'netsuite'", "'Idempotency-Key'", '/govps/']) assert(js.includes(value), value);
});
test('la cola conserva subsidiaria, reintentos y atención humana', async () => {
  const xml = await read('src/Objects/customrecord_govp_job.xml');
  for (const value of ['custrecord_govp_subsidiary', 'custrecord_govp_attempts', 'custrecord_govp_next_attempt', 'custrecord_govp_last_error']) assert(xml.includes(value), value);
});
test('la cola es interna y no exige permiso Administrador al User Event', async () => {
  const xml = await read('src/Objects/customrecord_govp_job.xml');
  assert.match(xml, /<accesstype>NONENEEDED<\/accesstype>/);
  assert.match(xml, /<allowuiaccess>F<\/allowuiaccess>/);
  assert.doesNotMatch(xml, /permittedrole/);
});
test('Map Reduce reduce el riesgo de duplicados con buffer y concurrencia uno', async () => {
  const xml = await read('src/Objects/customscript_govp_process_mr.xml');
  assert.match(xml, /<buffersize>1<\/buffersize>/);
  assert.match(xml, /<concurrencylimit>1<\/concurrencylimit>/);
});
test('la evidencia no incorpora campos personales', async () => {
  const js = await read('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_process_mr.js');
  for (const forbidden of ['customer_email', 'shipaddress', 'billaddress', 'phone']) assert(!js.includes(forbidden), forbidden);
});
