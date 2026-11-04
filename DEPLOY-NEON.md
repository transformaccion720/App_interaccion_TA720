# Despliegue de AulaViva — GitHub + Vercel + Neon

Guía paso a paso para llevar la plataforma a producción con base de datos **Neon (PostgreSQL)**.
Todo el código ya está listo: no hay nada específico de SQLite en la aplicación (los campos
JSON se guardan como texto, portables entre motores).

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

```bash
git init
git add .
git commit -m "AulaViva — plataforma de participación en clase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/aulaviva.git
git push -u origin main
```

> **Importante:** no subas el archivo `.env` (ya está excluido en `.gitignore`).
> Las credenciales se configuran en Vercel.

## 4. Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
2. Vercel detecta Next.js automáticamente. Antes de desplegar, abre **Environment Variables** y agrega:

   | Nombre | Valor |
   | --- | --- |
   | `DATABASE_URL` | cadena **pooled** de Neon |
   | `DIRECT_URL` | cadena **directa** de Neon |

3. Pulsa **Deploy**.

### Configuración de Prisma en el build

Vercel ejecuta `npm install` (o `bun install`), que a su vez corre `prisma generate`
mediante el hook `postinstall` si está definido. Añádelo en `package.json` si no existe:

```json
"scripts": {
  "postinstall": "prisma generate",
  "build": "prisma generate && next build"
}
```

## 5. Usar la plataforma en vivo

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
