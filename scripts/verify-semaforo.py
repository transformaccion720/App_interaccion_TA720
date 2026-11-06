# Verificación E2E del semáforo modo 'single' (pregunta → tarjetas verde/amarillo/rojo)
# 1) login admin  2) crear sesión  3) crear pregunta semáforo single
# 4) abrir pregunta  5) 4 participantes votan colores
# 6) resultados agregados correctos  7) segundo envío rechazado (409)
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
st, sess = req('POST', '/api/sessions', {'title': 'E2E Semáforo single'}, {'Authorization': f'Bearer {token}'})
check('crear sesión', st in (200, 201) and sess.get('id'), str(st))
sid = sess['id']
admin_code = sess.get('adminCode', '')

# 3) crear pregunta semáforo modo single
cfg = {
    'mode': 'single',
    'items': [],
    'labels': {
        'green': 'Verde — Puedo pegarla',
        'yellow': 'Amarillo — Con precaución',
        'red': 'Rojo — No debo pegarla',
    },
}
st, q = req('POST', f'/api/sessions/{sid}/questions', {
    'title': 'Si fuera a pegar esta información en una herramienta gratuita de IA, ¿qué color le asigna?',
    'description': 'Elige el color que mejor describe tu evaluación.',
    'type': 'semaforo',
    'config': cfg,
}, {'Authorization': f'Bearer {token}'})
check('crear pregunta semáforo', st in (200, 201) and q.get('id'), str(st))
qid = q['id']

# 4) abrir la pregunta (PATCH de estado) y poner la sesión en vivo
st, _ = req('PUT', f'/api/questions/{qid}', {'state': 'open'}, {'x-admin-code': admin_code, 'Authorization': f'Bearer {token}'})
check('abrir pregunta', st == 200, str(st))

# 5) participantes votan
colors = ['green', 'yellow', 'red', 'green']
ptokens = []
for name in ['Ana', 'Bruno', 'Caro', 'Diego']:
    st, p = req('POST', '/api/join', {'joinCode': sess.get('joinCode'), 'name': name})
    check(f'join {name}', st in (200, 201) and p.get('token'), str(st))
    ptokens.append(p['token'])

for name, tok, color in zip(['Ana', 'Bruno', 'Caro', 'Diego'], ptokens, colors):
    st, r = req('POST', f'/api/questions/{qid}/answer', {'token': tok, 'payload': {'color': color}})
    check(f'voto {name}={color}', st == 200, str(st))

# 5b) reintento de Ana → debe rechazarse (respuesta bloqueada)
st, r = req('POST', f'/api/questions/{qid}/answer', {'token': ptokens[0], 'payload': {'color': 'red'}})
check('bloqueo de respuesta (409)', st == 409, f'status={st}')

# 6) resultados agregados
st, live = req('POST', f'/api/sessions/{sid}/live', {}, {'Authorization': f'Bearer {token}'})
res = (live.get('resultsByQuestion') or {}).get(qid) or {}
data = res.get('data') or {}
check('tipo de resultado semaforo', res.get('type') == 'semaforo', str(res.get('type')))
check('modo single', data.get('mode') == 'single', str(data.get('mode')))
counts = data.get('counts') or {}
check('counts correctos', counts.get('green') == 2 and counts.get('yellow') == 1 and counts.get('red') == 1, str(counts))
check('total correcto', data.get('total') == 4, str(data.get('total')))

# 7) export CSV contiene la etiqueta del color
st, exp = req('GET', f'/api/sessions/{sid}/export', None, {'Authorization': f'Bearer {token}'})
if st == 200 and isinstance(exp, dict) and 'csv' in exp:
    csv_text = exp['csv']
else:
    csv_text = exp if isinstance(exp, str) else ''
check('CSV con etiqueta Verde — Puedo pegarla', 'Puedo pegarla' in csv_text)
check('CSV con etiqueta Rojo — No debo pegarla', 'No debo pegarla' in csv_text)

print()
print('RESULTADO:', 'TODO OK ✔' if ok else 'HAY FALLOS ✘')
raise SystemExit(0 if ok else 1)
