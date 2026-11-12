# Auditoría de seguridad: autenticación de Tasky

> Fecha: 2026-11-12. Alcance: inicio de sesión, contraseñas, sesiones y tokens, recuperación de contraseña, RLS,
> servidor MCP (`tasky-mcp`), CSP de la web y de Tauri, datos guardados en el dispositivo y secretos en el
> repositorio y en la web publicada.
>
> Regla seguida: solo cuenta como **verificado** lo que se ha comprobado con una prueba (petición real al
> servidor, lectura del código de la librería o test). Lo que depende del panel de Supabase y no se puede ver
> desde fuera está en [Comprobaciones manuales](#comprobaciones-manuales), con sus pasos.

## Resumen

| # | Hallazgo | Gravedad | Estado |
|---|----------|----------|--------|
| H1 | La app de escritorio no tenía CSP (`"csp": null`) | Media | Corregido (falta comprobarlo en la próxima compilación) |
| H2 | No había forma de cerrar las sesiones de otros dispositivos ni la de Claude | Media | Corregido |
| H3 | Cualquiera puede registrar un cliente OAuth con cualquier nombre (registro dinámico) | Media | Mitigado: aviso en la pantalla de autorización |
| H4 | Sin segundo factor (MFA) ni CAPTCHA en el inicio de sesión | Media | Pendiente (recomendación) |
| H5 | El hash de las contraseñas lo gestiona Supabase y no se puede ver desde el código | Informativo | Comprobación manual M1 |
| H6 | La recuperación de contraseña depende solo del buzón de correo | Media | Pendiente (configuración, M6) |
| H7 | La CSP web permitía conectar con cualquier proyecto `*.supabase.co` | Baja | Corregido |
| H8 | Un bloqueo por demasiados intentos mostraba un error técnico | Baja | Corregido |
| H9 | Los tokens del escritorio se guardan sin cifrar en el perfil de Windows | Baja | Aceptado (recomendación M9) |
| H10 | Claves antiguas (JWT legacy, `anon`/`service_role` legacy) posiblemente activas | Por determinar | Comprobación manual M5 |

Sin hallazgos (comprobado): registro desactivado, RLS sin acceso anónimo, MCP rechaza peticiones sin token o con
token falso, no hay secretos en el repositorio, en su historial ni en la web publicada, y los errores de acceso no
revelan si un email existe.

---

## Cómo funciona la autenticación (comprobado en el código)

- **Una sola vía de acceso:** email y contraseña con Supabase Auth (`signInWithPassword` en
  `src/adapters/supabaseSync.ts`). No hay registro en la app ni en el servidor.
- **La contraseña nunca se guarda en Tasky:** vive solo en el estado de `LoginForm` mientras se escribe y se envía
  por HTTPS a `/auth/v1/token`. Ningún archivo, base de datos local ni log la contiene (búsqueda de
  `password`, `access_token`, `refresh_token` en `%APPDATA%\com.tasky.app\*.json` y `backups\`: sin resultados).
- **Sesión:** Supabase guarda un *access token* (JWT de corta duración) y un *refresh token* en `localStorage`
  (clave `tasky-auth`) y lo renueva solo (`autoRefreshToken`). En la web sin sesión no se muestra ningún dato;
  en escritorio la sesión es opcional y solo activa la sincronización.
- **Datos:** todas las tablas tienen RLS forzada; solo el rol `authenticated`, dueño de la fila **y** presente en
  `private.allowed_users`, puede leer o escribir. No existe DELETE (borrado lógico).
- **MCP:** la Edge Function verifica el token OAuth del usuario con `withSupabase({ auth: 'user' })` y crea un
  cliente con ese token: todo pasa por las mismas políticas RLS. El código no usa la clave `service_role`.

## Pruebas realizadas (2026-11-12)

Todas con la clave *publishable* (pública) y sin sesión, solo lectura:

| Prueba | Resultado |
|--------|-----------|
| `GET /auth/v1/settings` | `disable_signup: true`, `anonymous_users: false`, solo `email` activo, `passkeys_enabled: false` |
| `GET /rest/v1/{projects,tasks,ideas,phases,habits,habit_logs,habit_ledger,habit_profile}` sin sesión | `401` · `permission denied for table …` en las 8 tablas |
| `GET /rest/v1/allowed_users` | `404`: la lista blanca no está expuesta por la API |
| `POST /functions/v1/tasky-mcp` sin token | `401` con `WWW-Authenticate: Bearer resource_metadata=…` |
| `POST /functions/v1/tasky-mcp` con un token falso | Rechazado: `INVALID_JWT` |
| Metadatos OAuth del servidor de autorización | `registration_endpoint` presente (registro dinámico activo → H3) |
| Cabeceras de `https://tasky-2dd.pages.dev/` | CSP, `nosniff`, `no-referrer`, `Permissions-Policy` y `frame-ancestors 'none'` presentes |
| Bundle publicado (19 archivos JS + `sw.js`) | Solo aparece la clave `sb_publishable_…`. La única coincidencia con `sb_secret_` es el código de la librería de Supabase que reconoce prefijos de claves |
| Historial de git (`git log --all -p`) | Sin `sb_secret_`, `service_role`, JWT ni contraseñas. `.env` estuvo versionado (d5216d8 → 77e7b9f) pero solo con la URL y la clave publishable; `supabase/.temp/linked-project.json` solo tenía la referencia del proyecto y de la organización |
| `.env` / `.env.offline` actuales | Solo `VITE_SUPABASE_URL` y una clave `sb_publishable_…`; ambos están en `.gitignore` |
| Cierre de sesión de supabase-js 2.119.0 (`GoTrueClient._signOut`) | Con `scope: 'local'` borra la sesión del dispositivo **antes** de llamar al servidor: sin red también se cierra. Con `'global'`, si el servidor no responde, devuelve error y **no** borra nada |

No se hicieron pruebas de escritura (insertar filas o intentar registrarse) contra el servidor real.

---

## Hallazgos

### H1 · La app de escritorio no tenía CSP — Media — Corregido

**Prueba:** `src-tauri/tauri.conf.json` tenía `"security": { "csp": null }`. Sin CSP, un fallo que permitiera
inyectar HTML o un script (p. ej. un texto mal tratado en una librería) podría leer el token de `localStorage` y
enviarlo a cualquier sitio, o usar los permisos de archivos de Tauri.

**Corrección:** CSP equivalente a la de la web, con lo que Tauri necesita para su IPC
(`ipc: http://ipc.localhost`) y solo el proyecto de Supabase en `connect-src`.
`dangerousDisableAssetCspModification: ["style-src"]` evita que Tauri añada un *nonce* a `style-src`, lo que
anularía `'unsafe-inline'` y bloquearía las etiquetas `<style>` que crea Motion (comprobado en el bundle).
`devCsp: null` deja `tauri dev` como estaba (Vite inyecta scripts en línea en desarrollo).
La configuración se ha validado contra el esquema de `@tauri-apps/cli`.

**Pendiente:** no se ha compilado la app de escritorio (fuera del alcance de esta tarea). En la próxima
compilación hay que comprobar: carga de datos, guardar, exportar a Descargas, sincronizar, avisos de Realtime y el
juego. Si algo fallara, la consola de WebView2 (F12 no está activa en release; usar `tauri dev` con
`devCsp` igual a `csp`) mostrará qué directiva lo bloquea.

### H2 · No había forma de cerrar las demás sesiones — Media — Corregido

**Prueba:** `signOut` usaba siempre `scope: 'local'` (solo este dispositivo). Si se perdía el iPhone o alguien
obtenía la contraseña o un token, no había forma desde la app de revocar sus sesiones ni la de Claude.

**Corrección:** nueva opción **«Cerrar sesión en todos los dispositivos…»** en el menú de sincronización
(`SyncButton`), con confirmación. Usa `scope: 'global'`, que revoca en el servidor todas las sesiones de la
cuenta. Si el servidor no responde, avisa del error y la sesión de este dispositivo sigue abierta (para no
creer que se ha revocado algo que no). Test: `src/state/sync.test.ts` («si no se pueden cerrar todas las
sesiones…»). Los demás dispositivos dejan de funcionar cuando caduca su *access token* (por defecto, 1 hora).

**No verificado:** que la revocación global también corte la conexión OAuth de Claude (según el diseño de
Supabase, los tokens del servidor OAuth son sesiones de la cuenta; comprobarlo la primera vez que se use).

### H3 · Registro dinámico de clientes OAuth — Media — Mitigado

**Prueba:** los metadatos públicos de Supabase Auth publican `registration_endpoint`. Cualquiera puede registrar
un cliente llamado «Claude» que redirija a su propio dominio y enviarte el enlace: si lo autorizas con tu sesión
iniciada, obtendría acceso a tus proyectos.

**Mitigación aplicada:** la pantalla `/oauth/consent` ya mostraba el destino; ahora además muestra un aviso
destacado cuando el destino no es Claude (`claude.ai`, `claude.com` y sus subdominios, por HTTPS) ni Claude Code
(`http://localhost` / `127.0.0.1`). La pantalla solo se ve con la sesión iniciada y no se puede incrustar en otra
web (`frame-ancestors 'none'`). **Recomendación:** ver M7 (revisar clientes y desactivar el registro dinámico
cuando no se esté conectando un asistente nuevo).

### H4 · Sin segundo factor ni CAPTCHA — Media — Pendiente

Toda la seguridad de la cuenta depende de la contraseña. Supabase limita los intentos por IP (M3), pero un
atacante con muchas IP o una contraseña filtrada/reutilizada entraría. **Recomendación** (requiere desarrollo):
MFA con TOTP de Supabase (gratis): alta del factor en la app, reto tras el login y políticas RLS que exijan
`aal2`. Mientras tanto: contraseña larga, única y generada (M2). CAPTCHA (Turnstile/hCaptcha) es otra opción,
pero exige cambios en la CSP y es menos útil que MFA para una sola cuenta.

### H5 · Almacenamiento de las contraseñas — Informativo — Comprobación manual M1

Tasky no guarda ni ve nunca la contraseña almacenada: lo hace Supabase Auth, que según su documentación y código
(GoTrue) guarda un hash **bcrypt con sal** (coste 10) en `auth.users.encrypted_password` (el nombre de la columna
dice *encrypted* pero es un hash, no cifrado reversible). La API no expone el esquema `auth`. Desde el código no
se puede comprobar el contenido: ver **M1**. Con bcrypt, una contraseña débil podría descifrarse por fuerza
bruta si alguien obtuviera la base de datos; una contraseña aleatoria de 16 caracteres o más no.

### H6 · Recuperación de contraseña — Media — Pendiente (configuración)

**Prueba:** la app no tiene flujo de recuperación ni cambio de contraseña (`detectSessionInUrl: false`, sin
pantalla). El endpoint público `/auth/v1/recover` de Supabase sí existe: envía un enlace de un solo uso al
correo de la cuenta. Quien controle ese buzón puede cambiar la contraseña. La respuesta del endpoint es la misma
exista o no el email (no permite averiguar la cuenta). **Recomendación:** M6 (URLs de redirección, cambio de
contraseña seguro, 2FA en el correo). Para recuperar el acceso, usar el panel de Supabase (Authentication → Users).

### H7 · CSP web demasiado amplia en `connect-src` — Baja — Corregido

`public/_headers` permitía `https://*.supabase.co` y `wss://*.supabase.co`: un script inyectado podría enviar
datos a un proyecto de Supabase del atacante. Ahora solo se permite `yfcidccclkndbqhqpmzp.supabase.co` y se
añade `object-src 'none'`. Se aplica al publicar la próxima versión en Cloudflare Pages.

### H8 · Mensaje ante bloqueo por intentos — Baja — Corregido

Un `429` de Supabase se mostraba como «Error del servidor: …». Ahora: «Demasiados intentos. Espera unos minutos
antes de volver a probar.» Los demás errores siguen sin distinguir entre email inexistente y contraseña
incorrecta («Email o contraseña incorrectos.»).

### H9 · Tokens en el dispositivo — Baja — Aceptado

- **Web/PWA:** `localStorage['tasky-auth']` (token de acceso y de renovación) y los datos en IndexedDB. Riesgo
  principal: XSS. Protegido por la CSP (`script-src 'self'`) y porque el código no usa `innerHTML`,
  `dangerouslySetInnerHTML`, `eval` ni `new Function` (búsqueda en `src/`). Al cerrar sesión en la web se borran
  los datos locales.
- **Escritorio:** el token vive en el `localStorage` de WebView2
  (`%LOCALAPPDATA%\com.tasky.app\EBWebView\…\Local Storage\leveldb`), sin cifrar; cualquier programa que se
  ejecute con tu usuario de Windows podría leerlo. Los datos (`%APPDATA%\com.tasky.app\tasky.json`,
  `habits.json`, `backups\`) no contienen credenciales. Mitigación: cifrado del disco (M9) y H2 para revocar.
- Los permisos de Tauri se limitan a `AppData` (lectura/escritura) y a escribir en Descargas.

### H10 · Claves antiguas de Supabase — Por determinar — Comprobación manual M5

El proyecto ya firma con claves asimétricas (ES256) y la app usa la clave `sb_publishable_…`, pero los metadatos
OAuth siguen listando `HS256`: desde fuera no se puede saber si el secreto JWT antiguo o las claves `anon` /
`service_role` antiguas siguen activos. Si lo están y alguna se filtrara (p. ej. una `service_role` antigua),
saltaría RLS por completo.

### No aplica / sin problema

- **HTTPS:** `pages.dev` pertenece al dominio `.dev`, que está en la lista de precarga HSTS de los navegadores:
  solo se puede abrir por HTTPS.
- **Enumeración de cuentas:** el login responde igual para email inexistente y contraseña incorrecta, y el
  registro está desactivado.
- **MCP:** expone 16 herramientas sobre proyectos, tareas e ideas (no Hábitos); los borrados son lógicos.

---

## Comprobaciones manuales

Panel: <https://supabase.com/dashboard/project/yfcidccclkndbqhqpmzp>

**M1 · Hash de contraseñas.** SQL Editor →
```sql
select email, left(encrypted_password, 7) as algoritmo, length(encrypted_password) as longitud from auth.users;
```
Correcto: `$2a$10$` (o `$2b$`) y longitud 60 (bcrypt con sal). Cualquier otra cosa → avisar.

**M2 · Política de contraseñas.** Authentication → Sign In / Providers → Email: longitud mínima ≥ 12, *Secure
password change* activado (pide reautenticación para cambiarla), *Secure email change* activado. Usar una
contraseña generada por un gestor, de 16+ caracteres, que no se use en ningún otro sitio. (*Leaked password
protection* solo existe en el plan Pro.)

**M3 · Límites contra fuerza bruta.** Authentication → Rate Limits: revisar «Sign-ups and sign-ins» y «Token
verifications» (por IP, cada 5 min). Para una sola persona se pueden bajar (p. ej. 10) sin notarlo.

**M4 · Renovación de tokens.** Authentication → Sessions (o Settings → Auth): *Detect and revoke potentially
compromised refresh tokens* activado (rotación con detección de reutilización), intervalo de reutilización
10 s. Settings → JWT Keys: caducidad del *access token* 3600 s o menos.

**M5 · Claves antiguas.** Settings → API Keys: si existen las claves *legacy* `anon` y `service_role`, desactivarlas
(la app usa `sb_publishable_…`). Settings → JWT Keys: si el secreto *legacy* (HS256) sigue como clave de
verificación y la clave actual es ES256, revocarlo. Después, comprobar que la app sincroniza y que el conector
MCP de Claude sigue funcionando; si algo falla, reactivar y avisar.

**M6 · Recuperación y redirecciones.** Authentication → URL Configuration: *Site URL*
`https://tasky-2dd.pages.dev` y en *Redirect URLs* solo direcciones propias (nada de comodines a otros dominios).
Activar la verificación en dos pasos en la cuenta de correo de Tasky: es la llave de la recuperación.

**M7 · Clientes OAuth.** Authentication → OAuth Server → Clients: borrar los que no reconozcas. Cuando Claude y
Claude Code estén conectados, se puede desactivar *Dynamic client registration* (Claude sigue renovando sus
tokens con su cliente ya registrado; para conectar un asistente nuevo, reactivarlo un momento).

**M8 · MFA (si se implementa H4).** Authentication → Multi-Factor: activar TOTP.

**M9 · Cifrado del disco en Windows.** Configuración → Privacidad y seguridad → Cifrado de dispositivo (o
BitLocker) activado. Protege el token y los datos de `%APPDATA%` / `%LOCALAPPDATA%` si se pierde el equipo.

---

## Archivos cambiados

- `src-tauri/tauri.conf.json` — CSP del escritorio (H1).
- `public/_headers` — `connect-src` limitado al proyecto, `object-src 'none'` (H7).
- `src/core/ports.ts`, `src/adapters/supabaseSync.ts`, `src/state/sync.ts`, `src/ui/sync/SyncButton.tsx` —
  cierre de sesión en todos los dispositivos (H2) y mensaje de bloqueo (H8).
- `src/ui/sync/ConsentPage.tsx` — aviso de destino desconocido (H3).
- `src/state/sync.test.ts` — test de H2.

Verificación: `tsc -b`, `eslint src` y `vitest run` (217 tests) en verde. Los cambios de interfaz (menú de
sincronización y pantalla de autorización) no se han probado en el navegador: necesitan una sesión real de
Supabase, y el modo `tasky-web-offline` no muestra el menú de sincronización.
