# Changelog

## 0.1.3 - 2026-08-18

- La caducidad se deriva de `trandate`, por lo que los reintentos idempotentes
  conservan el mismo cuerpo de emisión.
- Se rechazan fechas de transacción ausentes y periodos de validez no positivos.
- La suite comprueba explícitamente la vigencia estable en emisión y reintento.

## 0.1.2 - 2026-08-17

- La cola interna queda accesible a los scripts ejecutados por roles internos,
  sin exponer registros en la interfaz ni exigir rol Administrador al usuario.
- Buffer y concurrencia del Map/Reduce se fijan explícitamente a uno para
  reducir el riesgo de procesamiento duplicado.
- Pruebas con módulos `N/*` simulados para emisión, comprobación, API Secrets,
  idempotencia, duplicados y reintentos HTTP.
- Matriz de aceptación reproducible para el sandbox nativo.

## 0.1.1 - 2026-08-17

- Restringe explícitamente el User Event a Item Fulfillment e Item Receipt para
  que un deployment erróneo no convierta otro tipo de registro en comprobación.

## 0.1.0 - 2026-08-17

- SuiteApp SDF candidata con User Event y Map/Reduce SuiteScript 2.1.
- Item Fulfillment, Item Receipt, lotes, series, subsidiaria e idempotencia.
- Referencia segura a API Secrets, reintentos acotados y datos minimizados.
- Suite de contrato autocontenida; sandbox y validación SDF aún obligatorios.
