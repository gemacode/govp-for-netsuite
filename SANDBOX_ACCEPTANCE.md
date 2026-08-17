# Aceptación nativa de GOVP for NetSuite

Esta puerta debe ejecutarse en un sandbox NetSuite que tenga SDF y OAuth 2.0
habilitados y un rol SDF Developer. No se considera superada mediante mocks.

## Preparación

- Node.js 22 LTS y JDK 17 o 21.
- SuiteCloud CLI for Node.js instalado tras aceptar sus términos de Oracle.
- Autenticación del sandbox configurada mediante `suitecloud account:setup` o
  credenciales de máquina con `account:setup:ci`.
- API Secret `custsecret_govp_connector_token` restringido al dominio de GOVP
  Exchange y a los scripts de la SuiteApp.

## Secuencia y evidencias

1. Ejecutar `npm run check` y conservar la salida de las 18 pruebas.
2. Ejecutar `suitecloud project:validate` y conservar el log completo, versión
   de CLI, Account ID enmascarado y fecha.
3. Desplegar con `suitecloud project:deploy` y verificar que una actualización
   posterior también valida y despliega sin pérdida de cola.
4. Confirmar un Item Fulfillment: debe existir un único job `issue`, completarse
   y devolver código y URL GOVP.
5. Confirmar un Item Receipt con referencia: debe existir un único job `verify`
   y conservar el resultado de verificación.
6. Repetir ambos casos con lotes/series y dos subsidiarias; las claves deben ser
   distintas por subsidiaria y estables ante replay.
7. Simular HTTP 429 y 503: el job debe pasar a `retry`, respetar el backoff y no
   superar ocho intentos; un error permanente debe quedar en `attention`.
8. Ejecutar con un usuario interno no Administrador: el User Event debe poder
   crear la cola, que permanece oculta en la interfaz.
9. Desinstalar en sandbox y confirmar qué datos se conservan o eliminan antes de
   aprobar esa política para producción.

## Criterio de cierre

La puerta `nativeValidation` solo pasa cuando los nueve pasos tienen evidencia
sin secretos ni datos personales. Piloto externo y producción continúan siendo
puertas separadas.
