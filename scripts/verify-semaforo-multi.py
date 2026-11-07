# Verificación E2E del semáforo modo 'multi' (N preguntas → verde/amarillo/rojo por cada una)
# 1) login admin  2) crear sesión  3) crear pregunta semáforo multi con 3 preguntas internas
# 4) abrir pregunta  5) 3 participantes marcan color en cada pregunta
# 6) resultados agregados por pregunta correctos  7) segundo envío rechazado (409)
# 8) export CSV incluye cada pregunta y las etiquetas de color
import json
import urllib.request

BASE = 'http://localhost:3000'
EMAIL = 'docente@aulaviva.app'
PASS = 'AulaViva2026'


def req(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode('utf-8-sig')
            try:
                return resp.status, json.loads(raw)
            except Exception:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8-sig'))
        except Exception:
            return e.code, {}


ok = True
def check(name, cond, extra=''):
    global ok
    print(('✔' if cond else '✘ FALLO'), name, extra)
    if not cond:
        ok = False


# 1) login
st, login = req('POST', '/api/auth/login', {'email': EMAIL, 'password': PASS})
check('login', st == 200 and login.get('ok'))
token = login.get('token', '')

# 2) crear sesión
st, sess = req('POST', '/api/sessions', {'title': 'E2E Semáforo multi'}, {'Authorization': f'Bearer {token}'})
check('crear sesión', st in (200, 201) and sess.get('id'), str(st))
sid = sess['id']
admin_code = sess.get('adminCode', '')

# 3) crear pregunta semáforo modo multi (3 preguntas internas)
ITEMS = [
    {'id': 'it1', 'text': 'Puedo compartir datos personales del estudiante con la IA'},
    {'id': 'it2', 'text': 'Puedo pedirle ideas de actividades a la IA'},
    {'id': 'it3', 'text': 'Puedo pegar notas de clase completas en la IA'},
]
cfg = {
    'mode': 'multi',
    'items': ITEMS,
    'labels': {
        'green': 'Verde — Sí puedo',
        'yellow': 'Amarillo — Con cuidado',
        'red': 'Rojo — No debo',
    },
}
st, q = req('POST', f'/api/sessions/{sid}/questions', {
    'title': 'Evalúa cada uso de la herramienta gratuita de IA',
    'description': 'Marca un color para cada afirmación.',
    'type': 'semaforo',
    'config': cfg,
}, {'Authorization': f'Bearer {token}'})
check('crear pregunta semáforo multi', st in (200, 201) and q.get('id'), str(st))
qid = q['id']

# 4) abrir la pregunta
st, _ = req('PUT', f'/api/questions/{qid}', {'state': 'open'}, {'x-admin-code': admin_code, 'Authorization': f'Bearer {token}'})
check('abrir pregunta', st == 200, str(st))

# 5) participantes votan: colorVotes = {itemId: color}
#    it1: verde×2, amarillo×1 → líder verde
#    it2: rojo×2, amarillo×1  → líder rojo
#    it3: verde×1, amarillo×1, rojo×1 → empate a 1 (los 3 líderes)
VOTES = {
    'Ana':   {'it1': 'green',  'it2': 'red',    'it3': 'green'},
    'Bruno': {'it1': 'green',  'it2': 'red',    'it3': 'yellow'},
    'Caro':  {'it1': 'yellow', 'it2': 'yellow', 'it3': 'red'},
}
ptokens = []
for name in VOTES:
    st, p = req('POST', '/api/join', {'joinCode': sess.get('joinCode'), 'name': name})
    check(f'join {name}', st in (200, 201) and p.get('token'), str(st))
    ptokens.append(p['token'])

for (name, votes), tok in zip(VOTES.items(), ptokens):
    st, r = req('POST', f'/api/questions/{qid}/answer', {'token': tok, 'payload': {'colorVotes': votes}})
    check(f'votos de {name}', st == 200, str(st))

# 5b) reintento de Ana → debe rechazarse (respuesta bloqueada)
st, r = req('POST', f'/api/questions/{qid}/answer', {
    'token': ptokens[0],
    'payload': {'colorVotes': {'it1': 'red', 'it2': 'red', 'it3': 'red'}},
})
check('bloqueo de respuesta (409)', st == 409, f'status={st}')

# 6) resultados agregados por pregunta
st, live = req('POST', f'/api/sessions/{sid}/live', {}, {'Authorization': f'Bearer {token}'})
res = (live.get('resultsByQuestion') or {}).get(qid) or {}
data = res.get('data') or {}
check('tipo de resultado semaforo', res.get('type') == 'semaforo', str(res.get('type')))
check('modo multi', data.get('mode') == 'multi', str(data.get('mode')))
check('total correcto', data.get('total') == 3, str(data.get('total')))

items = {i.get('itemId'): i for i in (data.get('items') or [])}
check('agregado it1 (2 verde, 1 amarillo)', items.get('it1', {}).get('green') == 2 and items.get('it1', {}).get('yellow') == 1 and items.get('it1', {}).get('red') == 0, str(items.get('it1')))
check('agregado it2 (1 amarillo, 2 rojo)', items.get('it2', {}).get('yellow') == 1 and items.get('it2', {}).get('red') == 2 and items.get('it2', {}).get('green') == 0, str(items.get('it2')))
check('agregado it3 (1/1/1)', items.get('it3', {}).get('green') == 1 and items.get('it3', {}).get('yellow') == 1 and items.get('it3', {}).get('red') == 1, str(items.get('it3')))
check('líder it1 = verde', items.get('it1', {}).get('colorOverall') == 'green', str(items.get('it1', {}).get('colorOverall')))
check('líder it2 = rojo', items.get('it2', {}).get('colorOverall') == 'red', str(items.get('it2', {}).get('colorOverall')))

# 7) export CSV: cada pregunta y las etiquetas de color
st, exp = req('GET', f'/api/sessions/{sid}/export', None, {'Authorization': f'Bearer {token}'})
if st == 200 and isinstance(exp, dict) and 'csv' in exp:
    csv_text = exp['csv']
else:
    csv_text = exp if isinstance(exp, str) else ''
check('CSV con texto de la pregunta 1', 'datos personales' in csv_text)
check('CSV con etiqueta Verde — Sí puedo', 'Sí puedo' in csv_text)
check('CSV con etiqueta Rojo — No debo', 'No debo' in csv_text)

print()
print('RESULTADO:', 'TODO OK ✔' if ok else 'HAY FALLOS ✘')
raise SystemExit(0 if ok else 1)
