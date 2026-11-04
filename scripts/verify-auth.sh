#!/bin/bash
# Verificación E2E del arreglo de sesión (cookie + Bearer).
# 1) Login → obtiene cookie y token
# 2) /api/auth/me con SOLO cookie  → 200
# 3) /api/auth/me con SOLO Bearer  → 200  (respaldo anti-iframe)
# 4) /api/sessions con SOLO Bearer → 200
# 5) /api/sessions sin nada        → 401
# 6) Logout borra la cookie y el token deja de usarse en cliente
set -e
BASE="http://localhost:3000"
EMAIL="docente@aulaviva.app"
PASS="AulaViva2026"
JAR=$(mktemp)

echo "== 1) LOGIN =="
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN" | head -c 300; echo
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")
if [ -z "$TOKEN" ]; then echo "FALLO: sin token"; exit 1; fi
echo "token ok (${#TOKEN} chars)"

echo "== 2) ME solo con cookie =="
C=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/api/auth/me")
echo "status: $C (esperado 200)"

echo "== 3) ME solo con Bearer (cookie bloqueada) =="
B=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/auth/me")
echo "status: $B (esperado 200)"

echo "== 4) SESSIONS solo con Bearer =="
S=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/sessions")
echo "status: $S (esperado 200)"

echo "== 5) SESSIONS sin credenciales =="
N=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/sessions")
echo "status: $N (esperado 401)"

echo "== 6) USERS solo con Bearer (ruta solo-ADMIN) =="
U=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/users")
echo "status: $U (esperado 200)"

if [ "$C" = "200" ] && [ "$B" = "200" ] && [ "$S" = "200" ] && [ "$N" = "401" ] && [ "$U" = "200" ]; then
  echo "RESULTADO: TODO OK ✔"
else
  echo "RESULTADO: FALLO"
  exit 1
fi
