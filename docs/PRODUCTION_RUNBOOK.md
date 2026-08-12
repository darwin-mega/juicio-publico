# Juicio Público — salida a producción

## Regla de seguridad antes de desplegar

La URL `https://juicio-publico.vercel.app` contiene una versión más nueva que
la rama `main` de GitHub. No conectar Git ni promover un deployment de este
repositorio hasta recuperar esa fuente y reconciliar ambas versiones. Hacerlo
antes reemplazaría el login, la landing y funciones sociales visibles.

## Variables requeridas en Vercel

Configurar estos nombres en Production y Preview, sin copiar valores al repo:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_SALT` (aleatorio, mínimo 32 bytes)
- `CRON_SECRET` (aleatorio, mínimo 16 caracteres)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

El modo multidispositivo falla cerrado en producción si Redis no está
configurado. `/api/health` debe responder `200` y reportar `rooms: redis`.

## Supabase gratis

- Proyecto: `debyepmucrrnxzdfyoqa`.
- La migración `harden_rls_and_indexes` ya está aplicada.
- El cron diario de Vercel llama a `/api/cron/keep-supabase-active` y hace una
  lectura mínima. No inserta ni actualiza datos.
- Activar **Leaked password protection** en Authentication > Settings.
- Exportar un respaldo lógico antes de cambios de esquema importantes; el plan
  Free no incluye backups programados descargables.

## Verificación antes de promover

```text
npm ci
npm run lint -- --max-warnings=0
npm test
npm run build
npm audit --audit-level=moderate
```

Después del deployment:

1. Confirmar `/api/health` con estado `200`.
2. Crear una sala con cuatro dispositivos, iniciar, revelar roles, completar
   una ronda, votar, reiniciar y eliminar la sala.
3. Confirmar que `/manifest.webmanifest` y `/sw.js` responden `200`.
4. Verificar Modo Mesa sin red después de haber abierto sus pantallas una vez.
5. Revisar Security y Performance Advisors de Supabase.

## Contenedor Android recomendado

Usar Trusted Web Activity sobre la PWA de Vercel, no un WebView con
`server.url`. Para que aparezca sin barra del navegador hace falta publicar:

`/.well-known/assetlinks.json`

El archivo debe incluir `com.mafiajuiciopublico` y el SHA-256 del certificado
de **App signing** que muestra Play Console. No usar solamente el certificado
de upload: Google Play vuelve a firmar lo que distribuye.

## Prueba cerrada de Google Play

1. Cargar como testers los correos de cuentas Google de 12 personas.
2. Cada persona debe abrir el enlace de adhesión y aceptar la prueba.
3. Instalar desde Google Play y permanecer adherida durante 14 días continuos.
4. Play Console debe mostrar 12 testers aceptados; enviarles una invitación no
   alcanza.
5. Recién después completar la solicitud de acceso a producción.
