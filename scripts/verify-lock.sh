#!/bin/bash
# E2E: bloqueo de respuestas tras el primer envío.
# 1) Login admin → token
# 2) Crear sesión + pregunta de opción múltiple
# 3) Dos participantes entran (join)
# 4) P1 responde → OK; P1 reintenta → 409 (bloqueada)
# 5) P2 responde → OK; el conteo debe seguir en 2 respuestas totales
set -e
BASE="http://localhost:3000"

LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"docente@aulaviva.app","password":"AulaViva2026"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

SESS=$(curl -s -X POST "$BASE/api/sessions" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"E2E bloqueo","description":"prueba","maxParticipants":10}')
SID=$(echo "$SESS" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
CODE=$(echo "$SESS" | python3 -c "import sys,json;print(json.load(sys.stdin)['joinCode'])")
echo "sesión: $SID código: $CODE"

Q=$(curl -s -X POST "$BASE/api/sessions/$SID/questions" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"¿Cuál es tu color?","type":"multiple_choice","config":{"options":[{"id":"a","text":"Azul"},{"id":"b","text":"Verde"}],"multipleSelect":false}}')
QID=$(echo "$Q" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "pregunta: $QID"

# Activar la pregunta
curl -s -o /dev/null -X PUT "$BASE/api/questions/$QID" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"state":"open"}'

J1=$(curl -s -X POST "$BASE/api/join" -H 'Content-Type: application/json' -d "{\"joinCode\":\"$CODE\",\"name\":\"Ana\"}")
T1=$(echo "$J1" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
J2=$(curl -s -X POST "$BASE/api/join" -H 'Content-Type: application/json' -d "{\"joinCode\":\"$CODE\",\"name\":\"Beto\"}")
T2=$(echo "$J2" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

echo "== 4) P1 envía (esperado 200) =="
R1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/questions/$QID/answer" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$T1\",\"payload\":{\"optionIds\":[\"a\"]}}")
echo "status: $R1"

echo "== 4b) P1 reintenta con otra opción (esperado 409) =="
R2=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/questions/$QID/answer" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$T1\",\"payload\":{\"optionIds\":[\"b\"]}}")
echo "$R2" | tail -1

echo "== 5) P2 envía (esperado 200) y conteo =="
R3=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/questions/$QID/answer" \
  -H 'Content-Type: application/json' -d "{\"token\":\"$T2\",\"payload\":{\"optionIds\":[\"a\"]}}")
echo "status: $R3"

SYNC=$(curl -s -X POST "$BASE/api/participant/sync" -H 'Content-Type: application/json' -d "{\"token\":\"$T2\"}")
echo "$SYNC" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('answeredCount:', d['answeredCount'], '(esperado 2)')
print('totalParticipants:', d['totalParticipants'], '(esperado 2)')
counts=d['results']['data']['counts'] if d.get('results') else {}
print('counts:', counts, '(esperado a=2, b=0)  [nota: resultados solo visibles si state=revealed]')
assert d['answeredCount']==2, 'FALLO: el conteo no es 2'
print('BLOQUEO OK ✔')
"

# Cerrar la sesión de prueba para no dejar basura
curl -s -o /dev/null -X PUT "$BASE/api/sessions/$SID/manage" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"closed"}'
echo "sesión de prueba cerrada"
