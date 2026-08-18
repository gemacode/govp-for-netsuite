# GOVP for NetSuite

SuiteApp SDF abierta para automatizar GOVP desde NetSuite:

- Item Fulfillment crea un trabajo idempotente de emisión;
- Item Receipt comprueba el código indicado en **GOVP del proveedor**;
- Map/Reduce procesa volumen, reintentos y reconciliación sin bloquear la
  contabilización;
- lotes y series se incluyen en la evidencia canónica;
- el token se referencia desde **API Secrets**, nunca se guarda en scripts ni
  registros del SuiteApp.

## Estado 0.1.3

Candidato técnico reforzado. El proyecto, los scripts y 20 pruebas
autocontenidas están verificados, incluido el ciclo simulado de User Event y
Map/Reduce. La cola interna ya no exige que el usuario que confirma la
transacción tenga rol Administrador, el deployment fija buffer y concurrencia
a uno y la vigencia se deriva de la fecha estable de la transacción. La validación SDF conectada, instalación y ciclo bidireccional siguen
pendientes de un sandbox NetSuite. No es una release de producción.

## Configuración del sandbox

1. Cree el API Secret `custsecret_govp_connector_token`, restringido al dominio
   de Exchange y a los scripts GOVP.
2. Configure en el deployment Map/Reduce la URL
   `https://partners.gemacode.org/api/exchange`, el ID del secret y la validez.
3. Despliegue con SuiteCloud CLI y programe el Map/Reduce cada cinco minutos.
4. Pruebe Item Fulfillment, Item Receipt, lotes/series, devolución, replay,
   rate limit, permisos y dos subsidiarias antes de producción.

```bash
npm test
npm run check
suitecloud project:validate
suitecloud project:deploy
```

Los dos últimos comandos requieren una cuenta/sandbox autenticado. El código no
transmite nombres, email, direcciones ni teléfonos.

La evidencia que se debe conservar para superar la puerta nativa está definida
en [SANDBOX_ACCEPTANCE.md](SANDBOX_ACCEPTANCE.md).

Código y releases: <https://github.com/gemacode/govp-for-netsuite>.
