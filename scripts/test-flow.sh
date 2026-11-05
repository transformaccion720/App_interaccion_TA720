#!/bin/bash
# Prueba de flujo completo AulaViva (admin + participante)
set -e
BASE=http://localhost:3000
rm -f /tmp/tokens.txt /tmp/test_ids.env

echo "== 1. Crear demo =="
DEMO=$(curl -s -X POST $BASE/api/demo)
SID=$(echo $DEMO | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
ACODE=$(echo $DEMO | python3 -c "import sys,json;print(json.load(sys.stdin)['adminCode'])")
JCODE=$(echo $DEMO | python3 -c "import sys,json;print(json.load(sys.stdin)['joinCode'])")
echo "session=$SID admin=$ACODE join=$JCODE"

echo "== 2. Lookup admin =="
curl -s -X POST $BASE/api/sessions/lookup -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}"
echo

echo "== 3. Manage (GET) =="
curl -s $BASE/api/sessions/$SID/manage -H "x-admin-code: $ACODE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('preguntas:', len(d['questions']))
for q in d['questions']: print(' -', q['order'], q['type'], q['title'][:50], '| estado:', q['state'])
QID_MULTI=d['questions'][0]['id']; QID_SEM=d['questions'][1]['id']; QID_WC=d['questions'][2]['id']; QID_DT=d['questions'][3]['id']; QID_OT=d['questions'][4]['id']
with open('/tmp/test_ids.env','w') as f:
    f.write('SID=$SID\nACODE=$ACODE\nJCODE=$JCODE\nQID_MULTI='+QID_MULTI+'\nQID_SEM='+QID_SEM+'\nQID_WC='+QID_WC+'\nQID_DT='+QID_DT+'\nQID_OT='+QID_OT+'\n')
"
source /tmp/test_ids.env

echo "== 4. Unirse como 3 participantes =="
for NAME in "Ana Torres" "Luis Gómez" "María Pérez"; do
  R=$(curl -s -X POST $BASE/api/join -H 'Content-Type: application/json' -d "{\"joinCode\":\"$JCODE\",\"name\":\"$NAME\"}")
  TOK=$(echo $R | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
  echo "$TOK" >> /tmp/tokens.txt
  echo "unido: $NAME"
done

echo "== 5. Sync participante (sin pregunta activa) =="
TOK=$(head -1 /tmp/tokens.txt)
curl -s -X POST $BASE/api/participant/sync -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print('pregunta activa:',d['question'],'| total:',d['totalParticipants'])"

echo "== 6. Activar pregunta múltiple =="
curl -s -X PUT $BASE/api/questions/$QID_MULTI -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}'
echo

echo "== 7. Obtener config de opciones y votar =="
OPTS=$(curl -s $BASE/api/sessions/$SID/manage -H "x-admin-code: $ACODE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
q=[x for x in d['questions'] if x['id']=='$QID_MULTI'][0]
print(json.dumps([o['id'] for o in q['config']['options']]))")
O1=$(echo $OPTS | python3 -c "import sys,json;print(json.load(sys.stdin)[0])")
O2=$(echo $OPTS | python3 -c "import sys,json;print(json.load(sys.stdin)[1])")
i=0
while read -r TOK; do
  OID=$([ $((i % 2)) -eq 0 ] && echo $O1 || echo $O2)
  curl -s -X POST $BASE/api/questions/$QID_MULTI/answer -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\",\"payload\":{\"optionIds\":[\"$OID\"]}}" > /dev/null
  echo "voto $i registrado"
  i=$((i+1))
done < /tmp/tokens.txt

echo "== 8. Live admin: resultados =="
curl -s -X POST $BASE/api/sessions/$SID/live -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('activa:', d['activeQuestion']['title'][:40], '| respondieron:', d['activeQuestion']['answeredCount'], '| online:', d['onlineCount'])
print('resultados:', json.dumps(d['activeResults']['data']['counts']))
print('no respondieron:', d['notAnsweredActive'])
print('resultsByQuestion tiene', len(d['resultsByQuestion']), 'preguntas')
"

echo "== 9. Revelar resultados y sincronizar participante =="
echo -n "PUT revealed → "
curl -s -X PUT $BASE/api/questions/$QID_MULTI -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"revealed"}'
echo
TOK9=$(head -1 /tmp/tokens.txt)
curl -s -X POST $BASE/api/participant/sync -H 'Content-Type: application/json' -d "{\"token\":\"$TOK9\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print('estado:',d['question']['state'],'| resultados visibles:',d['results'] is not None,'| mi respuesta:',d['myAnswer'])"

echo "== 10. Semáforo: activar y votar =="
curl -s -X PUT $BASE/api/questions/$QID_SEM -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}' > /dev/null
ITEMS=$(curl -s $BASE/api/sessions/$SID/manage -H "x-admin-code: $ACODE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
q=[x for x in d['questions'] if x['id']=='$QID_SEM'][0]
print(json.dumps([i['id'] for i in q['config']['items']]))")
python3 - "$ITEMS" <<EOF
import json, subprocess
items = json.loads('''$ITEMS''')
toks = [t.strip() for t in open('/tmp/tokens.txt') if t.strip()]
votes_sets = [
    {i: 'valid' for i in items},
    {items[0]: 'valid', items[1]: 'invalid', items[2]: 'partial'},
    {i: 'invalid' for i in items},
]
for tok, votes in zip(toks, votes_sets):
    r = subprocess.run(['curl','-s','-X','POST','$BASE/api/questions/$QID_SEM/answer','-H','Content-Type: application/json','-d',json.dumps({'token':tok,'payload':{'votes':votes}})], capture_output=True, text=True)
    print('voto semáforo:', r.stdout.strip())
EOF

curl -s -X POST $BASE/api/sessions/$SID/live -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
sem=d['resultsByQuestion'].get('$QID_SEM')
print('semáforo total:', sem['data']['total'])
for it in sem['data']['items']: print(' item:', it['valid'], '/', it['partial'], '/', it['invalid'], '→', it['overall'])
"

echo "== 11. Árbol: recorrido + comentario =="
curl -s -X PUT $BASE/api/questions/$QID_DT -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}' > /dev/null
TOK=$(head -1 /tmp/tokens.txt)
curl -s -X POST $BASE/api/participant/sync -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
cfg=d['config']
root=[n for n in cfg['nodes'] if n['id']==cfg['rootId']][0]
leaf=[n for n in cfg['nodes'] if n['options'][0]['nextId'] is None][0]
payload={'steps':[{'nodeId':root['id'],'optionId':root['options'][0]['id']},{'nodeId':root['options'][0]['nextId'],'optionId':leaf['options'][0]['id']}],'leafOptionId':leaf['options'][0]['id'],'comment':'Me gusta estudiar con mapas porque visualizo mejor.'}
open('/tmp/dt_payload.json','w').write(json.dumps({'token':'$TOK','payload':payload}))
print('payload árbol listo')
"
curl -s -X POST $BASE/api/questions/$QID_DT/answer -H 'Content-Type: application/json' -d @/tmp/dt_payload.json
echo
curl -s -X POST $BASE/api/sessions/$SID/live -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
dt=d['resultsByQuestion'].get('$QID_DT')
print('árbol hojas:', [(l['label'][:30], l['count']) for l in dt['data']['leaves'] if l['count']>0])
print('comentarios:', dt['data']['comments'])
"

echo "== 12. Nube de palabras y abierta =="
curl -s -X PUT $BASE/api/questions/$QID_WC -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}' > /dev/null
i=0
while read -r TOK; do
  WORDS='["creatividad","trabajo en equipo"]'
  [ $i -eq 1 ] && WORDS='["creatividad","diversion"]'
  [ $i -eq 2 ] && WORDS='["aprendizaje"]'
  curl -s -X POST $BASE/api/questions/$QID_WC/answer -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\",\"payload\":{\"words\":$WORDS}}" > /dev/null
  i=$((i+1))
done < /tmp/tokens.txt
curl -s -X PUT $BASE/api/questions/$QID_OT -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}' > /dev/null
TOK12=$(tail -1 /tmp/tokens.txt)
echo -n "respuesta abierta → "
curl -s -X POST $BASE/api/questions/$QID_OT/answer -H 'Content-Type: application/json' -d "{\"token\":\"$TOK12\",\"payload\":{\"text\":\"¿Cómo aplico el árbol de decisiones a otros temas?\"}}"
curl -s -X POST $BASE/api/sessions/$SID/live -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
wc=d['resultsByQuestion'].get('$QID_WC')
print('nube:', wc['data']['words'])
ot=d['resultsByQuestion'].get('$QID_OT')
print('abierta:', ot['data']['items'])
"

echo "== 13. Export CSV =="
curl -s "$BASE/api/sessions/$SID/export?admin=$ACODE" | head -4

echo "== 14. Límite de participantes (cap) =="
S2=$(curl -s -X POST $BASE/api/sessions -H 'Content-Type: application/json' -d '{"title":"Cap test","maxParticipants":2}')
S2ID=$(echo $S2 | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
S2J=$(echo $S2 | python3 -c "import sys,json;print(json.load(sys.stdin)['joinCode'])")
curl -s -X POST $BASE/api/join -H 'Content-Type: application/json' -d "{\"joinCode\":\"$S2J\",\"name\":\"Uno\"}" > /dev/null
curl -s -X POST $BASE/api/join -H 'Content-Type: application/json' -d "{\"joinCode\":\"$S2J\",\"name\":\"Dos\"}" > /dev/null
echo -n "tercero debe fallar → "
curl -s -X POST $BASE/api/join -H 'Content-Type: application/json' -d "{\"joinCode\":\"$S2J\",\"name\":\"Tres\"}"

echo
echo "== 15. Respondió/no respondió por participante =="
curl -s -X PUT $BASE/api/questions/$QID_MULTI -H "x-admin-code: $ACODE" -H 'Content-Type: application/json' -d '{"state":"open"}' > /dev/null
curl -s -X POST $BASE/api/sessions/$SID/live -H 'Content-Type: application/json' -d "{\"adminCode\":\"$ACODE\"}" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d['participants']:
    print(f\"{p['name']}: online={p['online']} respondió_activa={p['answeredActive']} total={p['totalAnswers']}\")
"

echo "✅ FLUJO COMPLETO PROBADO"
