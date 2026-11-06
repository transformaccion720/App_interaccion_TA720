# Prepara una sesión demo (modo multi) con votos realistas para la captura visual.
# Imprime id de sesión y códigos.
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


st, login = req('POST', '/api/auth/login', {'email': EMAIL, 'password': PASS})
token = login.get('token', '')

st, sess = req('POST', '/api/sessions', {'title': 'Demo — Uso responsable de la IA en clase'}, {'Authorization': f'Bearer {token}'})
sid = sess['id']

ITEMS = [
    {'id': 'd1', 'text': 'Subir listas de notas del curso para que la IA haga el promedio'},
    {'id': 'd2', 'text': 'Pedir ideas de actividades para reforzar un tema difícil'},
    {'id': 'd3', 'text': 'Pegar correos de familias para redactar una respuesta'},
    {'id': 'd4', 'text': 'Generar rúbricas de evaluación para un proyecto'},
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
    'title': '¿Qué usos de la IA gratuita son adecuados en clase?',
    'description': 'Marca un color para cada uso propuesto.',
    'type': 'semaforo',
    'config': cfg,
}, {'Authorization': f'Bearer {token}'})
qid = q['id']

req('PUT', f'/api/questions/{qid}', {'state': 'open'}, {'x-admin-code': sess['adminCode'], 'Authorization': f'Bearer {token}'})

# 8 participantes con una distribución realista:
# d1 → rojo×6, amarillo×2 (líder rojo)
# d2 → verde×7, amarillo×1 (líder verde)
# d3 → rojo×5, amarillo×3 (líder rojo)
# d4 → verde×5, amarillo×2, rojo×1 (líder verde)
COLORS = [
    {'d1': 'red',    'd2': 'green',  'd3': 'red',    'd4': 'green'},
    {'d1': 'red',    'd2': 'green',  'd3': 'yellow', 'd4': 'green'},
    {'d1': 'red',    'd2': 'green',  'd3': 'red',    'd4': 'yellow'},
    {'d1': 'red',    'd2': 'green',  'd3': 'red',    'd4': 'green'},
    {'d1': 'red',    'd2': 'green',  'd3': 'red',    'd4': 'yellow'},
    {'d1': 'yellow', 'd2': 'green',  'd3': 'yellow', 'd4': 'green'},
    {'d1': 'red',    'd2': 'green',  'd3': 'red',    'd4': 'green'},
    {'d1': 'yellow', 'd2': 'yellow', 'd3': 'yellow', 'd4': 'green'},
]
names = ['Ana', 'Bruno', 'Caro', 'Diego', 'Elena', 'Farid', 'Gina', 'Hugo']
for name, votes in zip(names, COLORS):
    st, p = req('POST', '/api/join', {'joinCode': sess['joinCode'], 'name': name})
    req('POST', f'/api/questions/{qid}/answer', {'token': p['token'], 'payload': {'colorVotes': votes}})

print(json.dumps({'sessionId': sid, 'questionId': qid, 'joinCode': sess['joinCode'], 'adminCode': sess['adminCode']}))
