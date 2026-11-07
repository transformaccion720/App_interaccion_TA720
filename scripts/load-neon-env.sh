# Exporta las variables de .env (Neon) SOBRE las del entorno del sandbox.
# Uso:  source scripts/load-neon-env.sh && bun scripts/seed-teacher.ts
# No contiene secretos: los lee de .env (gitignored).
set -a
while IFS= read -r line; do
  case "$line" in ''|\#*) continue ;; esac
  export "$line"
done < "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.env"
set +a
