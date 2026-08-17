import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

let core;
const source = await readFile(new URL('../src/FileCabinet/SuiteApps/com.gemacode.govp/govp_core.js', import.meta.url), 'utf8');
vm.runInNewContext(source, { define(_deps, factory) { core = factory(); }, Error, Number, String, Set, JSON });

test('canonicaliza líneas, cantidades y series', () => {
  const result = core.canonicalLines([{ item: 'B', quantity: '2.00', serials: ['S2', 'S1', 'S1'] }, { item: 'A', quantity: 1 }]);
  assert.equal(result[0].item, 'A');
  assert.deepEqual(Array.from(result[1].serials), ['S1', 'S2']);
  assert.equal(result[1].quantity, '2');
});
test('el orden de entrada no cambia la forma canónica', () => {
  const lines = [{ item: 'B', quantity: 2 }, { item: 'A', quantity: 1 }];
  assert.equal(JSON.stringify(core.canonicalLines(lines)), JSON.stringify(core.canonicalLines([...lines].reverse())));
});
test('idempotencia estable y acotada', () => {
  const input = { accountId: '123_SB1', subsidiary: '2', recordType: 'itemfulfillment', recordId: '9', action: 'issue' };
  assert.equal(core.idempotencyKey(input), core.idempotencyKey(input));
  assert(core.idempotencyKey(input).length <= 160);
});
test('la subsidiaria aísla idempotencia', () => {
  const base = { accountId: '123', recordType: 'itemfulfillment', recordId: '9', action: 'issue' };
  assert.notEqual(core.idempotencyKey({ ...base, subsidiary: '1' }), core.idempotencyKey({ ...base, subsidiary: '2' }));
});
test('el backoff queda acotado', () => {
  assert.equal(core.retryDelaySeconds(1), 30); assert.equal(core.retryDelaySeconds(2), 60); assert.equal(core.retryDelaySeconds(99), 21600);
});
test('solo acepta el Exchange oficial HTTPS', () => {
  assert.equal(core.assertExchangeUrl('https://partners.gemacode.org/api/exchange/'), 'https://partners.gemacode.org/api/exchange');
  assert.throws(() => core.assertExchangeUrl('http://partners.gemacode.org/api/exchange'));
  assert.throws(() => core.assertExchangeUrl('https://127.0.0.1'));
});
