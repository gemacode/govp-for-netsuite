/**
 * @NApiVersion 2.1
 */
define([], () => {
  const text = value => value == null ? '' : String(value).trim();
  const quantity = value => {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) throw new Error('Cantidad GOVP inválida');
    return String(number);
  };
  const canonicalLines = lines => lines.map(line => ({
    item: text(line.item),
    quantity: quantity(line.quantity),
    unit: text(line.unit),
    location: text(line.location),
    lot: text(line.lot) || null,
    serials: [...new Set((line.serials || []).map(text).filter(Boolean))].sort(),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const idempotencyKey = ({ accountId, subsidiary, recordType, recordId, action }) => {
    const clean = value => text(value).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40);
    return ['netsuite', clean(accountId), clean(subsidiary || 'root'), clean(recordType), clean(recordId), clean(action)].join(':').slice(0, 160);
  };
  const retryDelaySeconds = attempt => Math.min(21600, 30 * (2 ** Math.max(0, Number(attempt || 1) - 1)));
  const validUntil = (anchor, validityDays) => {
    const days = Number(validityDays);
    if (!Number.isInteger(days) || days < 1) throw new Error('La validez GOVP debe ser un entero positivo');
    const parsed = anchor instanceof Date ? anchor.getTime() : Date.parse(String(anchor || ''));
    if (!Number.isFinite(parsed)) throw new Error('La transacción necesita una fecha estable para emitir GOVP');
    return new Date(parsed + days * 86400000).toISOString();
  };
  const assertExchangeUrl = value => {
    if (!/^https:\/\/partners\.gemacode\.org\/api\/exchange\/?$/.test(text(value))) {
      throw new Error('La versión candidata solo admite el Exchange oficial por HTTPS');
    }
    return text(value).replace(/\/$/, '');
  };
  return { canonicalLines, idempotencyKey, retryDelaySeconds, validUntil, assertExchangeUrl };
});
