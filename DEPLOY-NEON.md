# Despliegue de AulaViva — GitHub + Vercel + Neon

Guía paso a paso para llevar la plataforma a producción con base de datos **Neon (PostgreSQL)**.
Todo el código ya está listo: no hay nada específico de SQLite en la aplicación (los campos
JSON se guardan como texto, portables entre motores).

**Repositorio:** <https://github.com/transformaccion720/App_interaccion_TA720>

> **Historial ya depurado:** antes del primer push se reescribió el historial con
> `git filter-repo` para eliminar `.env`, la base SQLite local (`db/custom.db`) y
> archivos de trabajo (`tool-results/`). El repositorio no contiene secretos.
> `.env*` está en `.gitignore`: las credenciales viven solo en Vercel.

---

## 1. Crear la base de datos en Neon

1. Crea cuenta gratis en [neon.tech](https://neon.tech) → **New Project** (elige una región cercana, p. ej. `us-east-2` o `sa-east-1`).
2. En el **Dashboard** verás dos cadenas de conexión; cópialas ambas:
   - **Pooled connection** (termina en `-pooler...`): será `DATABASE_URL`.
   - **Direct connection**: será `DIRECT_URL`.
3. Si usan ramas (branches) de Neon, usa la rama `main` para producción.

## 2. Preparar el esquema para PostgreSQL

El proyecto trae dos esquemas:

| Archivo | Motor | Uso |
| --- | --- | --- |
| `prisma/schema.prisma` | SQLite | desarrollo local / demo |
| `prisma/schema.postgres.prisma` | PostgreSQL (Neon) | **producción** |

Para producción, copia el esquema de PostgreSQL sobre el principal:

```bash
cp prisma/schema.postgres.prisma prisma/schema.prisma
```

Crea tu `.env` local con las credenciales de Neon:

```env
DATABASE_URL="postgresql://USER:PASS@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
```

Y aplica el esquema a la base de datos:

```bash
bunx prisma db push
# o con npx: npx prisma db push
```

## 3. Subir a GitHub

El remoto ya está definido en el proyecto. Para publicar los cambios:

```bash
git remote add origin https://github.com/transformaccion720/App_interaccion_TA720.git  # si no existe
git push -u origin main
```

El push por HTTPS pide usuario + **Personal Access Token** (fine-grained, scope
`Contents: read/write` sobre ese repo). Alternativa sin token desde tu equipo:
GitHub CLI (`gh auth login`) o SSH.

> **Importante:** nunca subas el archivo `.env` (excluido en `.gitignore`).
> Las credenciales se configuran solo en Vercel.

## 4. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → importa
   `transformaccion720/App_interaccion_TA720`.
2. Antes de desplegar, abre **Environment Variables** y agrega:

   | Nombre | Valor |
   | --- | --- |
   | `DATABASE_URL` | cadena **pooled** de Neon (termina en `-pooler…`) |
   | `DIRECT_URL` | cadena **directa** de Neon |
   | `AUTH_SECRET` | secreto nuevo para firmar sesiones: `openssl rand -hex 32` |

3. En **Settings → Build & Output Settings**, sobrescribe el **Build Command** con:

   ```bash
   cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate && next build
   ```

   Esto es **obligatorio**: el `schema.prisma` del repo usa SQLite para desarrollo
   local; en el build de Vercel hay que generar el cliente Prisma contra el esquema
   PostgreSQL (`prisma/schema.postgres.prisma`).

4. Pulsa **Deploy**.

### Con el CLI de Neon (opcional, automatiza el paso 2)

```bash
npm i -g neon@latest                  # CLI v9.x
export NEON_API_KEY=<tu-api-key>      # crea el key en neon.tech → Account → API keys
neon init -y --org-id <ORG_ID> --project-id <PROJECT_ID> --branch production --services postgres
neon deploy                           # aplica neon.ts (política de ramas); sin cambios si ya coincide
```

`neon init` vincula el proyecto (archivo `.neon`, gitignored), preserva `neon.ts` y vuelca
las variables de Neon en `.env`: `DATABASE_URL` (**pooled**) y `DATABASE_URL_UNPOOLED`
(directa). Completa `.env` con:

```env
DIRECT_URL=<el mismo valor de DATABASE_URL_UNPOOLED>
AUTH_SECRET=<genera uno nuevo: openssl rand -hex 32>
```

Aplica el esquema y crea la cuenta admin:

```bash
npx prisma generate --schema prisma/schema.postgres.prisma
npx prisma db push --schema prisma/schema.postgres.prisma
bun scripts/seed-teacher.ts
```

> **Entornos que ya exportan `DATABASE_URL`** (sandboxes, CI): el proceso gana sobre
> `.env`. Carga primero `source scripts/load-neon-env.sh` (lee `.env` y fuerza las
> variables de Neon). Para volver a desarrollo local con SQLite usa `.env.sqlite`.

El API key se puede revocar al terminar desde **Account → API keys**.

## 5. Crear la cuenta del administrador (obligatorio)

El registro público está **deshabilitado**: solo el administrador crea cuentas de
docente o moderador desde el panel (pestaña **Usuarios**). Tras aplicar el esquema,
crea la cuenta inicial de administrador:

```bash
# apuntando DATABASE_URL / DIRECT_URL a Neon y con el cliente generado
# desde prisma/schema.postgres.prisma:
npx tsx scripts/seed-teacher.ts
# Crea: docente@aulaviva.app / AulaViva2026 (rol ADMIN)
```

> **Importante:** entra al panel, cambia esa contraseña desde *Usuarios → Restablecer
> contraseña*, y crea ahí mismo las cuentas docente/moderador que necesites.
> La sesión de **demo** (sesión de ejemplo con los 6 tipos de preguntas) también es
> exclusiva del administrador: no aparece para el público ni para docentes.

## 6. Usar la plataforma en vivo

1. Comparte a tus alumnos la URL pública: `https://tu-app.vercel.app/join` — con el **código de 6 caracteres** o escaneando el **QR** que proyecta el panel docente.
2. Tu panel está en `https://tu-app.vercel.app/admin`; guárdalo con su **código de administrador** (lo ves en «Ajustes») para reabrirlo desde cualquier equipo.
3. Límite por sesión: 100 alumnos por defecto (configurable hasta 500 al crear la sesión).

## Notas técnicas

- **Tiempo real:** la plataforma usa sondeo inteligente cada 2 s (participante y panel docente).
  Es la forma 100 % compatible con Vercel *serverless* + Neon para hasta 100 participantes;
  no requiere servidores WebSocket externos.
- **Adjuntos de imagen:** se almacenan como *data URL* (base64) dentro de PostgreSQL;
  límite práctico ≈1.5 MB por imagen. También acepta URLs externas.
- **Exportación:** el panel docente permite descargar todas las respuestas en CSV compatible con Excel (UTF-8 con BOM, separador `;`).
- **Escalado:** si algún día superas los 100 participantes simultáneos por sesión, el siguiente paso
  natural es mover el sondeo a Server-Sent Events (SSE) o a un servicio WebSocket dedicado (p. ej. Railway/Render);
  el resto de la aplicación no cambiaría.
