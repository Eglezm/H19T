# H19T — Torneos de golf

App de torneos entre amigos: modalidad individual, pareja, threesome, foursome o
fivesome, formato scramble con handicap ajustado por porcentaje, y marcador
cruzado por equipos (cada equipo anota el score del siguiente en su grupo de
salida, en cadena).

Construida con React + Vite + Firebase Realtime Database, mismo estilo visual
que H19 Golf. **Comparte el directorio de jugadores** (`directorio` en
Firebase) con H19 Golf, así que los handicaps se mantienen sincronizados entre
ambas apps.

## Desarrollo local

```bash
npm install
npm run dev
```

## Deploy en Netlify

**Opción A — desde un repo de GitHub (recomendado):**
1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. En Netlify: "Add new site" → "Import an existing project" → conecta el repo.
3. Build command: `npm run build` — Publish directory: `dist` (ya viene
   configurado en `netlify.toml`, Netlify lo detecta solo).
4. Deploy.

**Opción B — arrastrar y soltar:**
```bash
npm install
npm run build
```
Luego arrastra la carpeta `dist/` generada a app.netlify.com (sitio → "Deploys" → arrastrar carpeta).

## Notas

- **PIN de administrador**: `1919` (constante `ADMIN_PIN` en `src/App.jsx`,
  cámbialo si quieres uno distinto al de H19 Golf).
- **Firebase**: usa el mismo proyecto que H19 Golf. Si prefieres una base de
  datos separada, reemplaza `firebaseConfig` en `src/App.jsx` con tu propio
  proyecto de Firebase (Realtime Database).
- **Rutas de acceso**:
  - `/` → pantalla de inicio (Admin / código de equipo / ver torneo)
  - `/?equipo=CODIGO` → acceso directo de un equipo a anotar su score
  - `/?torneo=CODIGO` → vista pública de solo lectura del torneo en vivo
- No incluye apuestas de dinero ni GPS de distancia al green (a diferencia de
  H19 Golf) — el torneo se decide solo por menor score neto total.
