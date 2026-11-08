#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# AulaViva — Actualiza el esquema de la base de datos Neon (PostgreSQL).
#
# Cuándo usarlo: cada vez que el proyecto añada campos nuevos al esquema
# (p. ej. la columna «scheduledAt» de Session añadida en nov 2026) y ANTES de
# desplegar la versión nueva del código en Vercel.
#
# Uso (copia la cadena «Pooled connection» del panel de Neon):
#   DATABASE_URL='postgresql://usuario:clave@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' \
#     bash scripts/neon-db-push.sh
#
# También vale darle la cadena directa (sin «-pooler»): el script la detecta.
# ---------------------------------------------------------------------------
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo ""
  echo "  Falta la cadena de conexión de Neon."
  echo ""
  echo "  1. Abre console.neon.tech → tu proyecto → Dashboard → «Connection string»."
  echo "  2. Copia la opción «Pooled connection» (empieza por postgresql:// y"
  echo "     contiene -pooler en el host)."
  echo "  3. Ejecuta:"
  echo ""
  echo "     DATABASE_URL='pegala-aqui-sin-comillas-internas' bash scripts/neon-db-push.sh"
  echo ""
  exit 1
fi

URL="$DATABASE_URL"

# Quitar comillas envolventes si el usuario las pegó (error común).
if [[ "$URL" =~ ^[\"\'].*[\"\']$ ]]; then
  URL="${URL:1:${#URL}-2}"
fi

if [[ "$URL" != postgresql://* && "$URL" != postgres://* ]]; then
  echo "✗ La cadena no empieza por postgresql:// — pega la cadena de conexión de Neon, no una ruta de SQLite (file:…)."
  exit 1
fi

# Neon: las migraciones (DDL) van mejor por el endpoint DIRECTO.
# La cadena pooled contiene «-pooler.» en el host; la versión directa es el
# mismo host sin ese sufijo. Si el usuario ya pegó la directa, no cambia nada.
DIRECT_URL="${URL/-pooler./.}"

if [ "$DIRECT_URL" != "$URL" ]; then
  echo "→ Usando el endpoint directo de Neon para el cambio de esquema (sin «-pooler»)."
fi

echo "→ Aplicando prisma/schema.postgres.prisma a la base de datos…"
DATABASE_URL="$DIRECT_URL" npx prisma db push --schema prisma/schema.postgres.prisma

echo ""
echo "✔ Base de datos actualizada. Ya puedes desplegar la versión nueva del código."
