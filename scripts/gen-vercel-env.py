# Genera download/vercel-env-aulaviva.txt a partir de .env (valores nunca impresos en el chat).
# El formato del archivo está optimizado para copiar cada valor COMPLETO en Vercel.
import re, pathlib

env = pathlib.Path('/home/z/my-project/.env.production').read_text()

def val(k: str) -> str:
    m = re.search(rf'^{k}=(.*)$', env, re.M)
    v = m.group(1).strip().strip('"') if m else ''
    if not v:
        raise SystemExit(f'FALTA {k} en .env')
    return v

DATABASE_URL = val('DATABASE_URL')
DIRECT_URL = val('DIRECT_URL')
AUTH_SECRET = val('AUTH_SECRET')

# Datos estructurales (sin la contraseña) para la sección de verificación.
m = re.match(r'postgres(ql)?://([^:@]+):([^@]*)@([^/?]+)(/[^?]*)', DATABASE_URL)
usuario, password, host_pooled, dbpath = m.group(2), m.group(3), m.group(4), m.group(5)
pass_len = len(password)

contenido = f'''============================================================
 VARIABLES DE ENTORNO PARA VERCEL — AulaViva
============================================================
DÓNDE: vercel.com > tu proyecto > Settings > Environment Variables
       Como las variables YA EXISTEN, usa el botón de los tres puntos (...)
       junto a cada una y elige EDIT (no crees duplicados).
ENTORNOS: deja marcadas Production, Preview Y Development en cada una.
CÓMO PEGAR: borra TODO el valor anterior y pega la línea completa de abajo,
       desde "postgresql://" hasta el final ("sslmode=require"), SIN comillas
       y SIN espacios. Selecciona la línea entera antes de copiar.
============================================================

1) DATABASE_URL  (conexión POOLED — host -pooler)

DATABASE_URL={DATABASE_URL}

2) DIRECT_URL  (conexión DIRECTA para migraciones)

DIRECT_URL={DIRECT_URL}

3) AUTH_SECRET  (firma de sesiones)

AUTH_SECRET={AUTH_SECRET}

============================================================
 BUILD COMMAND OVERRIDE
 Settings > Build & Output Settings > Build Command > Override:
============================================================

cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate && next build

============================================================
 VERIFICACIÓN DESPUÉS DE DESPLEGAR
 Abre https://TU-APP.vercel.app/api/health y compara:
============================================================

  "ok": true
  "db": {{
    "ok": true,
    "urlEsPostgres": true,
    "urlLongitud": {len(DATABASE_URL)},
    "usuario": "{usuario}",
    "tienePassword": true,
    "passwordLongitud": {pass_len},
    "host": "{host_pooled}",
    "nombreBD": "{dbpath.lstrip('/')}",
    "parametros": "?channel_binding=require&sslmode=require"
  }},
  "esquema": {{ "ok": true }},
  "auth": {{ "secretConfigurado": true }}

Si "tienePassword" es false o "nombreBD" está vacío, el valor quedó mal pegado:
edita la variable y pega la línea completa otra vez.

============================================================
 ACCESO
 Panel docente: https://TU-APP.vercel.app/admin
 Cuenta admin: docente@aulaviva.app (contraseña definida en el seed)
============================================================
'''

out = pathlib.Path('/home/z/my-project/download/vercel-env-aulaviva.txt')
out.write_text(contenido)
print(f'OK: {out} ({len(contenido)} bytes) — URL={len(DATABASE_URL)} chars, pass_len={pass_len}, host={host_pooled}')
