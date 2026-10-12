# Cliente web estático SEGUNDS

Este directorio es el contenido preparado para el repositorio público
`lauraac/segunds-clientes`. GitHub Pages solo publica archivos estáticos: el
gateway Node se hospeda aparte y sigue ejecutando RPC privadas en Supabase.

## Configuración en el repositorio destino

1. En **Settings → Pages**, selecciona **GitHub Actions** como fuente de publicación.
2. En **Settings → Secrets and variables → Actions → Variables**, crea
   `SEGUNDS_CLIENT_API_URL` con el origen HTTPS público del backend Node, por
   ejemplo `https://api.tu-dominio.com` (sin `/api` ni ruta final). Es una URL
   pública, no un secreto.
3. Sube estos archivos a la rama `main`. Actions genera `dist` y publica Pages.
4. Comprueba `https://lauraac.github.io/segunds-clientes/` y una ruta de mesa
   `/segunds-clientes/t/<32-hex>`.

La página 404 de Pages conserva el identificador opaco del QR, redirige a la
aplicación bajo `/segunds-clientes/` y lo entrega como `?table=<id>`. La web carga
el menú público a través del backend y las operaciones de sesión nunca llaman
directamente a Supabase desde el navegador.

## Backend que debe hospedarse aparte

El origen configurado en `SEGUNDS_CLIENT_API_URL` debe ejecutar el gateway
`backend/web/server.mjs` del repositorio SEGUNDS y tener acceso saliente a Supabase.
Configura allí `CLIENT_ORIGIN=https://lauraac.github.io`; `API_ORIGIN` es opcional
si Render proporciona `RENDER_EXTERNAL_URL`, y solo requiere valor manual para
usar un dominio personalizado. `SUPABASE_SERVICE_ROLE_KEY` y `SESSION_HMAC_SECRET`
permanecen exclusivamente en el gestor de secretos del hosting del backend.
Nunca los añadas a este repositorio, a Pages variables, al frontend o a Android.

El gateway solo acepta el origen de Pages y un conjunto cerrado de rutas. Las
credenciales temporales del cliente son aleatorias, se limitan a la sesión/mesa,
se guardan en `sessionStorage` del navegador y el servidor las valida contra
Supabase; no son claves administrativas. Se revocan al cerrar sesión. No se
usan cookies de terceros, que algunos navegadores móviles bloquean.

GitHub Actions falla de forma segura si falta la variable pública del API o si no
es HTTPS. El paso de generación copia solo `index.html`, `app.js`, `styles.css`,
el colibrí, el manejador 404 y la configuración pública del API. No copia `.env`,
`supabase.properties`, claves ni código Node al artefacto.

## QR en Android

En `supabase.properties` (local, no subirlo al repositorio Android), configura:

```properties
QR_CLIENT_BASE_URL=https://lauraac.github.io/segunds-clientes/
```

Actualiza la app instalada recompilando el APK. El QR abre
`https://lauraac.github.io/segunds-clientes/t/<identificador-opaco>`; Pages atiende
el acceso directo usando `404.html`. La web y el backend deben estar publicados
antes de imprimir los QR permanentes.

## Preparar y subir desde PowerShell

Los siguientes comandos clonan el repositorio público si aún no existe en la ruta
indicada, copian el sitio (incluido `.github`) y suben los cambios a `main`:

```powershell
$source = 'C:\Users\laura\AndroidStudioProjects\Segunds\backend\web\github-pages'
$destination = Join-Path $env:USERPROFILE 'AndroidStudioProjects\segunds-clientes'
if (-not (Test-Path (Join-Path $destination '.git'))) {
    git clone https://github.com/lauraac/segunds-clientes.git $destination
}
Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -notin @('dist', '.gitignore') } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
}
Set-Location $destination
git add .
git commit -m "Prepare SEGUNDS customer site for GitHub Pages"
git push origin main
```

Si ya tienes el repositorio clonado en otra ruta, cambia `$destination` por esa
ruta. Revisa los cambios antes de ejecutar `git push`; ese comando publica el
sitio. No se ha publicado desde el repositorio Android.
