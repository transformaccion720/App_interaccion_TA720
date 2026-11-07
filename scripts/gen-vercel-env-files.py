# Crea un archivo por variable en download/vercel/ con SOLO el valor exacto
# (sin salto de línea final) para copiar/pegar en Vercel sin errores.
# Los valores se leen de .env y NUNCA se imprimen en el chat.
import re, pathlib

env = pathlib.Path('/home/z/my-project/.env.production').read_text()
out_dir = pathlib.Path('/home/z/my-project/download/vercel')
out_dir.mkdir(parents=True, exist_ok=True)

def val(k: str) -> str:
    m = re.search(rf'^{k}=(.*)$', env, re.M)
    v = m.group(1).strip().strip('"') if m else ''
    if not v:
        raise SystemExit(f'FALTA {k} en .env')
    return v

archivos = {
    'DATABASE_URL.txt': val('DATABASE_URL'),
    'DIRECT_URL.txt': val('DIRECT_URL'),
    'AUTH_SECRET.txt': val('AUTH_SECRET'),
    'BUILD_COMMAND.txt': 'cp prisma/schema.postgres.prisma prisma/schema.prisma && npx prisma generate && next build',
}

for nombre, valor in archivos.items():
    p = out_dir / nombre
    p.write_text(valor)  # SIN \n final: pegar tal cual
    print(f'{nombre}: {len(valor)} caracteres')

# Validación estricta: cada archivo debe ser byte a byte igual al valor de .env
ok = True
for nombre in ['DATABASE_URL.txt', 'DIRECT_URL.txt', 'AUTH_SECRET.txt']:
    k = nombre.replace('.txt', '')
    if (out_dir / nombre).read_text() != val(k):
        ok = False
        print(f'ERROR: {nombre} no coincide con .env')
print('VALIDACION:', 'TODOS EXACTOS ✓' if ok else 'FALLÓ ✗')
