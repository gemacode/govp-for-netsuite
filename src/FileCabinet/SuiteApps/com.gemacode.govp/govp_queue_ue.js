/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search', './govp_core'], (record, runtime, search, core) => {
  const JOB = 'customrecord_govp_job';
  const afterSubmit = context => {
    if (context.type === context.UserEventType.DELETE) return;
    const source = context.newRecord;
    const action = source.type === record.Type.ITEM_FULFILLMENT ? 'issue' : 'verify';
    const reference = action === 'verify' ? source.getValue({ fieldId: 'custbody_govp_reference' }) : '';
    if (action === 'verify' && !reference) return;
    const key = core.idempotencyKey({
      accountId: runtime.accountId,
      subsidiary: source.getValue({ fieldId: 'subsidiary' }) || 'root',
      recordType: source.type,
      recordId: source.id,
      action,
    });
    const duplicate = search.create({ type: JOB, filters: [['externalid', 'is', key]], columns: ['internalid'] }).run().getRange({ start: 0, end: 1 });
    if (duplicate.length) return;
    const job = record.create({ type: JOB });
    job.setValue({ fieldId: 'externalid', value: key });
    job.setValue({ fieldId: 'custrecord_govp_action', value: action });
    job.setValue({ fieldId: 'custrecord_govp_source_type', value: source.type });
    job.setValue({ fieldId: 'custrecord_govp_source_id', value: String(source.id) });
    job.setValue({ fieldId: 'custrecord_govp_subsidiary', value: String(source.getValue({ fieldId: 'subsidiary' }) || '') });
    job.setValue({ fieldId: 'custrecord_govp_reference', value: String(reference || '') });
    job.setValue({ fieldId: 'custrecord_govp_status', value: 'pending' });
    job.setValue({ fieldId: 'custrecord_govp_next_attempt', value: new Date() });
    job.save({ enableSourcing: false, ignoreMandatoryFields: false });
  };
  return { afterSubmit };
});
