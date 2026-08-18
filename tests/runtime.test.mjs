import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const loadAmd = async (path, modules = {}) => {
  let exported;
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    define(dependencies, factory) {
      exported = factory(...dependencies.map(dependency => modules[dependency]));
    },
    Date,
    Error,
    JSON,
    Math,
    Number,
    Set,
    String,
    encodeURIComponent,
    log: { error() {} },
  });
  return exported;
};

const core = await loadAmd('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_core.js');

test('el User Event encola emisión y evita duplicados', async () => {
  const saved = [];
  let duplicate = false;
  const record = {
    Type: { ITEM_FULFILLMENT: 'itemfulfillment', ITEM_RECEIPT: 'itemreceipt' },
    create() {
      const values = {};
      return {
        setValue({ fieldId, value }) { values[fieldId] = value; },
        save() { saved.push(values); return saved.length; },
      };
    },
  };
  const search = { create: () => ({ run: () => ({ getRange: () => duplicate ? [{ id: '1' }] : [] }) }) };
  const script = await loadAmd('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_queue_ue.js', {
    'N/record': record,
    'N/runtime': { accountId: '123_SB1' },
    'N/search': search,
    './govp_core': core,
  });
  const source = {
    type: record.Type.ITEM_FULFILLMENT,
    id: '42',
    getValue: ({ fieldId }) => fieldId === 'subsidiary' ? '2' : '',
  };
  const context = { type: 'create', UserEventType: { DELETE: 'delete' }, newRecord: source };
  script.afterSubmit(context);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].custrecord_govp_action, 'issue');
  assert.equal(saved[0].custrecord_govp_status, 'pending');
  assert.match(saved[0].externalid, /^netsuite:123_SB1:2:itemfulfillment:42:issue$/);
  duplicate = true;
  script.afterSubmit(context);
  assert.equal(saved.length, 1);
});

test('el User Event solo verifica recepciones que tengan referencia', async () => {
  const saved = [];
  const record = {
    Type: { ITEM_FULFILLMENT: 'itemfulfillment', ITEM_RECEIPT: 'itemreceipt' },
    create: () => {
      const values = {};
      return { setValue: ({ fieldId, value }) => { values[fieldId] = value; }, save: () => saved.push(values) };
    },
  };
  const script = await loadAmd('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_queue_ue.js', {
    'N/record': record,
    'N/runtime': { accountId: '123' },
    'N/search': { create: () => ({ run: () => ({ getRange: () => [] }) }) },
    './govp_core': core,
  });
  const source = {
    type: record.Type.ITEM_RECEIPT,
    id: '7',
    values: { subsidiary: '3', custbody_govp_reference: '' },
    getValue({ fieldId }) { return this.values[fieldId] || ''; },
  };
  const context = { type: 'create', UserEventType: { DELETE: 'delete' }, newRecord: source };
  script.afterSubmit(context);
  assert.equal(saved.length, 0);
  source.values.custbody_govp_reference = 'GOVP-001';
  script.afterSubmit(context);
  assert.equal(saved[0].custrecord_govp_action, 'verify');
  assert.equal(saved[0].custrecord_govp_reference, 'GOVP-001');
});

const mapReduceHarness = async ({ action, response, reference = '', attempts = 0 }) => {
  const values = {
    custrecord_govp_action: action,
    custrecord_govp_source_type: action === 'issue' ? 'itemfulfillment' : 'itemreceipt',
    custrecord_govp_source_id: '42',
    custrecord_govp_reference: reference,
    custrecord_govp_attempts: attempts,
    externalid: `netsuite:123:root:${action}:42`,
  };
  const saves = [];
  const job = {
    getValue: ({ fieldId }) => values[fieldId],
    setValue: ({ fieldId, value }) => { values[fieldId] = value; },
    save: () => { saves.push({ ...values }); return '1'; },
  };
  const transaction = {
    getValue: ({ fieldId }) => fieldId === 'trandate' ? new Date('2026-08-17T00:00:00.000Z') : '',
    getLineCount: () => 1,
    getSublistText: ({ fieldId }) => ({ item: 'Widget', units: 'Unit', location: 'Madrid' })[fieldId] || '',
    getSublistValue: ({ fieldId }) => fieldId === 'quantity' ? 2 : '100',
    getSublistSubrecord: () => { throw new Error('sin detalle'); },
  };
  const requests = [];
  const https = {
    Method: { GET: 'GET', POST: 'POST' },
    request: options => { requests.push(options); return response; },
  };
  const script = await loadAmd('src/FileCabinet/SuiteApps/com.gemacode.govp/govp_process_mr.js', {
    'N/crypto': {
      HashAlg: { SHA256: 'sha256' },
      createHash: () => {
        const hash = crypto.createHash('sha256');
        return { update: ({ input }) => hash.update(input), digest: () => hash.digest('hex') };
      },
    },
    'N/encode': { Encoding: { UTF_8: 'utf8', HEX: 'hex' } },
    'N/https': https,
    'N/record': { load: ({ type }) => type === 'customrecord_govp_job' ? job : transaction },
    'N/runtime': {
      accountId: '123',
      getCurrentScript: () => ({ getParameter: ({ name }) => ({
        custscript_govp_exchange_url: 'https://partners.gemacode.org/api/exchange',
        custscript_govp_secret_id: 'custsecret_govp_connector_token',
        custscript_govp_validity_days: 365,
      })[name] }),
    },
    'N/search': { create: options => options },
    './govp_core': core,
  });
  script.map({ value: JSON.stringify({ id: '1' }) });
  return { values, saves, requests };
};

test('Map/Reduce emite con API Secret, idempotencia y huella canónica', async () => {
  const result = await mapReduceHarness({
    action: 'issue',
    response: { code: 201, body: JSON.stringify({ govp: { code: 'GOVP-NEW', verifyUrl: 'https://partners.gemacode.org/g/GOVP-NEW' } }) },
  });
  assert.equal(result.values.custrecord_govp_status, 'completed');
  assert.equal(result.values.custrecord_govp_govp_code, 'GOVP-NEW');
  assert.equal(result.requests[0].method, 'POST');
  assert.equal(result.requests[0].headers.Authorization, 'Bearer {custsecret_govp_connector_token}');
  assert.equal(result.requests[0].headers['Idempotency-Key'], result.values.externalid);
  assert.match(result.requests[0].body, /"sha256":"[a-f0-9]{64}"/);
  assert.equal(JSON.parse(result.requests[0].body).validUntil, '2027-08-17T00:00:00.000Z');
});

test('la vigencia depende de la fecha de transacción y no del momento del reintento', () => {
  const anchor = new Date('2026-08-17T00:00:00.000Z');
  assert.equal(core.validUntil(anchor, 30), '2026-09-16T00:00:00.000Z');
  assert.equal(core.validUntil(new Date(anchor), 30), core.validUntil(anchor, 30));
  assert.throws(() => core.validUntil('', 30), /fecha estable/);
  assert.throws(() => core.validUntil(anchor, 0), /entero positivo/);
});

test('Map/Reduce verifica y convierte un 503 en reintento acotado', async () => {
  const verified = await mapReduceHarness({
    action: 'verify',
    reference: 'GOVP / 001',
    response: { code: 200, body: JSON.stringify({ verification: { status: 'valid' } }) },
  });
  assert.equal(verified.values.custrecord_govp_status, 'completed');
  assert.equal(verified.values.custrecord_govp_verification, 'valid');
  assert.match(verified.requests[0].url, /GOVP%20%2F%20001$/);

  const retried = await mapReduceHarness({
    action: 'issue',
    attempts: 1,
    response: { code: 503, body: '{}' },
  });
  assert.equal(retried.values.custrecord_govp_status, 'retry');
  assert.equal(retried.values.custrecord_govp_attempts, 2);
  assert(retried.values.custrecord_govp_next_attempt instanceof Date);
  assert.match(retried.values.custrecord_govp_last_error, /HTTP 503/);
});
