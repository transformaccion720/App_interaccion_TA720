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
2. En el **Dashboard** copia la cadena **Pooled connection** (el host termina en
   `-pooler...`): será `DATABASE_URL`. Es la **única** variable de base de datos que
   la aplicación necesita (la conexión directa ya no se usa en el esquema).
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
DATABASE_URL=postgresql://USER:PASS@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

> En un archivo `.env` local las comillas son aceptables; al pegar el valor en
> **Vercel**, hazlo **sin comillas** y sin espacios.

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
   | `DATABASE_URL` | cadena **pooled** de Neon (empieza con `postgresql://`, host `-pooler…`, termina con `?sslmode=require`) |
   | `AUTH_SECRET` | secreto para firmar sesiones: `openssl rand -hex 32` |

   > Solo **2 variables**. `DIRECT_URL` ya no se usa: si la dejaste configurada
   > puedes borrarla. El build ahora ejecuta `scripts/vercel-preflight.mjs`, que
   > **detiene el deploy con un mensaje claro** si `DATABASE_URL` no es una cadena
   > de Neon válida o falta `AUTH_SECRET` — así nunca más se publica una app que
   > no puede iniciar sesión por una variable mal pegada.

3. En **Settings → Build & Output Settings**, sobrescribe el **Build Command** con:

   ```bash
   npm run vercel-build
   ```

   (equivale a: preflight de variables → copiar esquema PostgreSQL → `prisma generate` → `next build`).

   > **Desde la versión actual el repo ya se auto-configura en Vercel:** `postinstall`
   > genera el cliente Prisma PostgreSQL y existe un script `vercel-build` con los
   > mismos pasos. El override del dashboard es opcional (recomendado por claridad).

   Antes era obligatorio porque el `schema.prisma` del repo usa SQLite para desarrollo
   local; en el build de Vercel hay que generar el cliente Prisma contra el esquema
   PostgreSQL (`prisma/schema.postgres.prisma`).

4. Pulsa **Deploy**.

**Verificación después del deploy:** abre `https://tu-app.vercel.app/api/health`.
Debe responder `{"ok":true,"db":{"ok":true,...}}`. Si `db.ok` es `false`, el campo
`error` indica la causa (p. ej. cliente SQLite vs PostgreSQL, o `DATABASE_URL`
malformado: `urlEsPostgres:false`). El login puede tardar unos segundos más en la
primera llamada porque Neon despierta el cómputo si estaba suspendido.

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

### Actualizar la base de datos en Neon (cuando el código añade campos nuevos)

Si despliegas una versión del código que usa campos nuevos del esquema y la base de
datos aún no los tiene, el panel mostrará «No se pudieron cargar las sesiones» y
`/api/health` puede seguir respondiendo `ok:true` (la conexión es buena; falta la
columna). Ejemplo: la versión de nov 2026 añadió `Session.scheduledAt` (fecha
programada de la sesión).

Solución — un solo comando con la cadena de Neon (antes de desplegar, o justo
después; tarda segundos y no borra datos):

```bash
DATABASE_URL='postgresql://usuario:clave@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' \
  bash scripts/neon-db-push.sh
# equivalente: npm run db:push:neon (leyendo DATABASE_URL del entorno)
```

El script quita comillas accidentales, valida la cadena y usa automáticamente el
endpoint **directo** de Neon (sin `-pooler`) para el cambio de esquema, que es lo
recomendado por Neon para DDL. No hace falta repetirlo salvo que el esquema vuelva
a cambiar.

## 5. Crear la cuenta del administrador (obligatorio)

El registro público está **deshabilitado**: solo el administrador crea cuentas de
docente o moderador desde el panel (pestaña **Usuarios**). Tras aplicar el esquema,
crea la cuenta inicial de administrador:

```bash
# apuntando DATABASE_URL a Neon (source scripts/load-neon-env.sh) y con el
# cliente generado desde prisma/schema.postgres.prisma:
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

## 7. Si el inicio de sesión sigue fallando en Vercel

La pantalla de login ahora **muestra la causa real** del error (recuadro rojo bajo el
formulario, con un enlace «Ver diagnóstico técnico» que consulta `/api/health`).
Los 3 fallos típicos y cómo se ven:

1. **«La variable DATABASE_URL no está configurada en este entorno»** — las variables
   se añadieron solo para *Development*: Vercel separa Production / Preview / Development.
   Marca **las tres casillas** (o al menos Production) para cada variable y vuelve a desplegar.
2. **«La cadena de conexión no es válida… pegó con comillas»** — el valor se copió con las
   comillas del archivo de texto. En Vercel el valor se pega **sin comillas** y sin espacios.
3. **«No se pudo conectar a la base de datos»** — la URL no es la *pooled* de Neon
   (`...-pooler...`) o el branch de Neon está suspendido (entra al panel de Neon y actívalo).
4. **«La URL must start with the protocol `postgresql://`»** y en `/api/health` se ve
   `esquemaDetectado: "file:"` con `urlLongitud` ≈ 20–25 — el valor de `DATABASE_URL`
   es una **ruta de base SQLite** (p. ej. `file:./prisma/dev.db`), no la cadena de Neon.
   Edita la variable en Vercel, pega la *pooled connection* (empieza con
   `postgresql://`) sin comillas y vuelve a desplegar. Desde esta versión el
   propio **build de Vercel se detiene con un mensaje claro** si detecta esto
   (script `vercel-preflight`).

Checklist mínimo tras cambiar variables o código:

1. Abre `https://TU-APP.vercel.app/api/health` → debe responder
   `"ok": true` con `urlEsPostgres: true`, `urlLongitud` ≈ 149 y `esquema.ok: true`.
2. Si `/api/health` da 404: el deploy está desactualizado o falló el build →
   revisa en Vercel → *Deployments* que el último deploy sea **Ready** y con el
   commit más reciente; si no, *Redeploy*.
3. Los cambios de variables de entorno **exigen un nuevo deploy**: después de
   editarlas, *Deployments → Redeploy → Redeploy* (así se inyectan en las funciones).

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
