# Tasky

Gestor personal de proyectos, tareas e ideas. App de escritorio para Windows (Tauri 2), sin conexión y sin inicio de sesión. Documentación completa: [TASKY_GUIDE.md](TASKY_GUIDE.md).

## Instalar en Windows

1. **Generar el instalador** (solo hace falta tras cambiar el código):
   ```bash
   npm run tauri build
   ```
   El instalador queda en `src-tauri\target\release\bundle\nsis\Tasky_<versión>_x64-setup.exe`.
2. **Instalar:** doble clic en el instalador → *Instalar* → *Terminar*. No pide permisos de administrador: se instala solo para tu usuario en `%LOCALAPPDATA%\Tasky`.
   - Si aparece «Windows protegió su PC» (SmartScreen, porque el instalador no está firmado), pulsa *Más información* → *Ejecutar de todas formas*.
3. **Abrir desde el buscador:** tecla Windows → escribe `tasky` → Enter.
4. **Anclar a la barra de tareas:** con Tasky abierto, clic derecho en su icono de la barra de tareas → *Anclar a la barra de tareas*. (También: buscador → clic derecho en Tasky → *Anclar a la barra de tareas* / *Anclar a Inicio*.)

## Actualizar

Genera un instalador nuevo y ejecútalo: reemplaza la versión instalada y **conserva tus datos**. No hace falta desinstalar antes.

## Tus datos

- Archivo: `%APPDATA%\com.tasky.app\tasky.json` (pega la ruta en el Explorador).
- Copias automáticas diarias (las 14 últimas) en `%APPDATA%\com.tasky.app\backups\`.
- Copia manual: menú *Copias de seguridad* de la cabecera → *Exportar copia* (va a Descargas) / *Importar copia…*.
- Desinstalar Tasky (Configuración → Aplicaciones) **no borra** tus datos, salvo que marques la casilla de eliminar los datos de la aplicación en el desinstalador.

## Desarrollo

```bash
npm install
npm run tauri dev     # app de escritorio con recarga en caliente
npm run dev           # solo navegador (datos en IndexedDB)
npm test              # tests
npm run lint
```

## iPhone (PWA)

1. En Safari abre **https://tasky-2dd.pages.dev** → *Compartir → Añadir a pantalla de inicio*.
2. Abre Tasky desde el icono e inicia sesión con tu cuenta. Funciona también sin conexión.

Cada vez que se sube código a la rama `main` de GitHub, Cloudflare Pages publica la versión nueva sola; la app instalada se actualiza al abrirla.

## Sincronización (Supabase)

- **Escritorio:** icono de nube de la cabecera → *Activar sincronización…* → tu email y contraseña. Sin sesión, Tasky funciona solo en local como siempre.
- **Web/iPhone:** el acceso es obligatorio. *Cerrar sesión* borra los datos de ese dispositivo (siguen en el servidor).
- La única cuenta se crea en el panel de Supabase (*Authentication → Users*); el registro público está desactivado y la cuenta debe estar en la lista blanca (ver el final de [supabase/schema.sql](supabase/schema.sql)).
- Plan gratuito: si el proyecto de Supabase se pausa tras 7 días sin uso, reactívalo desde el panel; mientras tanto Tasky sigue funcionando en local.

## Probar la PWA en red local (desarrollo)

```bash
npm run build
npx vite preview --host --port 4173
```

Abre en Safari `http://<IP del PC>:4173`. Por HTTP no hay modo sin conexión (requiere HTTPS).
