/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/crypto', 'N/encode', 'N/https', 'N/record', 'N/runtime', 'N/search', './govp_core'],
  (crypto, encode, https, record, runtime, search, core) => {
    const JOB = 'customrecord_govp_job';
    const F = id => `custrecord_govp_${id}`;
    const parameters = () => {
      const script = runtime.getCurrentScript();
      const endpoint = core.assertExchangeUrl(script.getParameter({ name: 'custscript_govp_exchange_url' }));
      const secretId = String(script.getParameter({ name: 'custscript_govp_secret_id' }) || '');
      if (!/^custsecret_[a-z0-9_]+$/.test(secretId)) throw new Error('Configure un ID de API Secret válido');
      return { endpoint, secretId, validity: Number(script.getParameter({ name: 'custscript_govp_validity_days' }) || 365) };
    };
    const getInputData = () => search.create({ type: JOB, filters: [
      [[F('status'), 'is', 'pending'], 'or', [F('status'), 'is', 'retry']],
      'and', [F('next_attempt'), 'onorbefore', 'now']
    ], columns: ['internalid'] });
    const inventory = (transaction, line) => {
      try {
        const detail = transaction.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line });
        const values = [];
        for (let index = 0; index < detail.getLineCount({ sublistId: 'inventoryassignment' }); index += 1) {
          values.push(String(detail.getSublistText({ sublistId: 'inventoryassignment', fieldId: 'issueinventorynumber', line: index }) || detail.getSublistText({ sublistId: 'inventoryassignment', fieldId: 'receiptinventorynumber', line: index }) || ''));
        }
        return values.filter(Boolean);
      } catch (_) { return []; }
    };
    const lines = transaction => {
      const result = [];
      const count = transaction.getLineCount({ sublistId: 'item' });
      for (let line = 0; line < count; line += 1) result.push({
        item: transaction.getSublistText({ sublistId: 'item', fieldId: 'item', line }) || transaction.getSublistValue({ sublistId: 'item', fieldId: 'item', line }),
        quantity: transaction.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line }),
        unit: transaction.getSublistText({ sublistId: 'item', fieldId: 'units', line }) || '',
        location: transaction.getSublistText({ sublistId: 'item', fieldId: 'location', line }) || '',
        lot: null, serials: inventory(transaction, line),
      });
      return core.canonicalLines(result);
    };
    const sha256 = value => {
      const hash = crypto.createHash({ algorithm: crypto.HashAlg.SHA256 });
      hash.update({ input: value, inputEncoding: encode.Encoding.UTF_8 });
      return hash.digest({ outputEncoding: encode.Encoding.HEX });
    };
    const request = (config, path, method, body, key) => {
      const options = {
        url: config.endpoint + path, method,
        credentials: [config.secretId],
        headers: { Accept: 'application/json', Authorization: `Bearer {${config.secretId}}`, 'Content-Type': 'application/json' },
      };
      if (key) options.headers['Idempotency-Key'] = key;
      if (body) options.body = JSON.stringify(body);
      const response = https.request(options);
      if (response.code < 200 || response.code >= 300) {
        const error = new Error(`GOVP Exchange HTTP ${response.code}`); error.retryable = response.code === 429 || response.code >= 500; throw error;
      }
      return JSON.parse(response.body);
    };
    const map = context => {
      const jobId = JSON.parse(context.value).id;
      const job = record.load({ type: JOB, id: jobId });
      const attempts = Number(job.getValue({ fieldId: F('attempts') }) || 0) + 1;
      job.setValue({ fieldId: F('attempts'), value: attempts });
      job.setValue({ fieldId: F('status'), value: 'processing' });
      job.save();
      try {
        const config = parameters();
        const action = job.getValue({ fieldId: F('action') });
        const sourceType = job.getValue({ fieldId: F('source_type') });
        const sourceId = job.getValue({ fieldId: F('source_id') });
        const transaction = record.load({ type: sourceType, id: sourceId });
        let result;
        if (action === 'issue') {
          const canonical = JSON.stringify(lines(transaction));
          const key = job.getValue({ fieldId: 'externalid' });
          const validUntil = core.validUntil(transaction.getValue({ fieldId: 'trandate' }), config.validity);
          result = request(config, '/connectors/issue', https.Method.POST, {
            issuer: { name: `NetSuite ${runtime.accountId}` },
            subject: { type: 'shipment', id: String(sourceId), name: `Item Fulfillment ${sourceId}` },
            requirement: 'Demostrar la expedición y sus líneas antes de aceptar la recepción.',
            evidence: [{ label: 'Huella canónica de líneas, lotes y series', sha256: sha256(canonical) }],
            validUntil,
            source: { platform: 'netsuite', externalId: key },
          }, key);
          job.setValue({ fieldId: F('govp_code'), value: result.govp.code });
          job.setValue({ fieldId: F('verify_url'), value: result.govp.verifyUrl });
        } else {
          const code = String(job.getValue({ fieldId: F('reference') }));
          result = request(config, `/govps/${encodeURIComponent(code)}`, https.Method.GET);
          job.setValue({ fieldId: F('govp_code'), value: code });
          job.setValue({ fieldId: F('verification'), value: String(result.verification.status) });
        }
        job.setValue({ fieldId: F('status'), value: 'completed' });
        job.setValue({ fieldId: F('last_error'), value: '' });
      } catch (error) {
        job.setValue({ fieldId: F('status'), value: error.retryable && attempts < 8 ? 'retry' : 'attention' });
        job.setValue({ fieldId: F('last_error'), value: String(error.message || error).slice(0, 999) });
        if (error.retryable && attempts < 8) job.setValue({ fieldId: F('next_attempt'), value: new Date(Date.now() + core.retryDelaySeconds(attempts) * 1000) });
      }
      job.save();
    };
    const summarize = summary => { if (summary.inputSummary.error) log.error({ title: 'GOVP input', details: summary.inputSummary.error }); };
    return { getInputData, map, summarize };
  });
