# Verificación E2E del semáforo modo 'multi' (N preguntas → tarjetas verde/amarillo/rojo por pregunta)
# 1) login admin  2) crear sesión  3) crear pregunta semáforo multi (3 preguntas internas)
# 4) abrir  5) 4 participantes votan colores en las 3 preguntas
# 6) agregación por pregunta correcta  7) bloqueo de reenvío  8) CSV con etiquetas
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
join_code = sess.get('joinCode', '')

# 3) crear pregunta semáforo multi con 3 preguntas internas
inner = [
    {'id': 'q1', 'text': '¿Datos de contacto de clientes en una IA gratuita?'},
    {'id': 'q2', 'text': '¿Un resumen de una noticia pública?'},
    {'id': 'q3', 'text': '¿El borrador interno de la empresa?'},
]
cfg = {
    'mode': 'multi',
    'items': inner,
    'labels': {
        'green': 'Verde — Puedo pegarla',
        'yellow': 'Amarillo — Con precaución',
        'red': 'Rojo — No debo pegarla',
    },
}
st, q = req('POST', f'/api/sessions/{sid}/questions', {
    'title': '¿Qué información puedes pegar en una IA gratuita? Evalúa cada caso.',
    'description': 'Marca un color para cada caso.',
    'type': 'semaforo',
    'config': cfg,
}, {'Authorization': f'Bearer {token}'})
check('crear pregunta multi', st in (200, 201) and q.get('id'), str(st))
qid = q['id']

# 4) abrir la pregunta
st, _ = req('PUT', f'/api/questions/{qid}', {'state': 'open'}, {'x-admin-code': admin_code, 'Authorization': f'Bearer {token}'})
check('abrir pregunta', st == 200, str(st))

# 5) participantes votan (patrón conocido)
VOTOS = {
    'Ana':   {'q1': 'green',  'q2': 'yellow', 'q3': 'red'},
    'Bruno': {'q1': 'green',  'q2': 'green',  'q3': 'red'},
    'Caro':  {'q1': 'yellow', 'q2': 'green',  'q3': 'red'},
    'Diego': {'q1': 'green',  'q2': 'yellow', 'q3': 'green'},
}
ptokens = []
for name in VOTOS:
    st, p = req('POST', '/api/join', {'joinCode': join_code, 'name': name})
    check(f'join {name}', st in (200, 201) and p.get('token'), str(st))
    ptokens.append((name, p['token']))

for name, tok in ptokens:
    st, r = req('POST', f'/api/questions/{qid}/answer', {'token': tok, 'payload': {'colorVotes': VOTOS[name]}})
    check(f'votos de {name}', st == 200, str(st))

# 5b) reintento → bloqueado
st, r = req('POST', f'/api/questions/{qid}/answer', {'token': ptokens[0][1], 'payload': {'colorVotes': VOTOS['Ana']}})
check('bloqueo de respuesta (409)', st == 409, f'status={st}')

# 6) agregación: q1 g=3/y=1/r=0 (verde) · q2 g=2/y=2/r=0 · q3 g=1/r=3 (rojo)
st, live = req('POST', f'/api/sessions/{sid}/live', {}, {'Authorization': f'Bearer {token}'})
res = (live.get('resultsByQuestion') or {}).get(qid) or {}
data = res.get('data') or {}
check('tipo semaforo', res.get('type') == 'semaforo', str(res.get('type')))
check('modo multi', data.get('mode') == 'multi', str(data.get('mode')))
check('total participantes', data.get('total') == 4, str(data.get('total')))
items = {i['itemId']: i for i in (data.get('items') or [])}
check('q1: verde 3 / amarillo 1', items.get('q1', {}).get('green') == 3 and items.get('q1', {}).get('yellow') == 1, str(items.get('q1')))
check('q2: verde 2 / amarillo 2', items.get('q2', {}).get('green') == 2 and items.get('q2', {}).get('yellow') == 2, str(items.get('q2')))
check('q3: rojo 3 / verde 1', items.get('q3', {}).get('red') == 3 and items.get('q3', {}).get('green') == 1, str(items.get('q3')))
check('q1 predominante verde', items.get('q1', {}).get('colorOverall') == 'green', str(items.get('q1', {}).get('colorOverall')))
check('q3 predominante rojo', items.get('q3', {}).get('colorOverall') == 'red', str(items.get('q3', {}).get('colorOverall')))

# 7) CSV con las etiquetas y textos
st, exp = req('GET', f'/api/sessions/{sid}/export', None, {'Authorization': f'Bearer {token}'})
csv_text = exp.get('csv') if isinstance(exp, dict) else exp
check('CSV con etiqueta Verde — Puedo pegarla', 'Puedo pegarla' in csv_text)
check('CSV con texto de pregunta interna', 'noticia pública' in csv_text)

print()
print('RESULTADO:', 'TODO OK ✔' if ok else 'HAY FALLOS ✘')
raise SystemExit(0 if ok else 1)
