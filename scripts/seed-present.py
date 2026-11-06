# Siembra una sesión demo con respuestas de prueba para verificar el modo presentación.
# Uso: python3 scripts/seed-present.py
import json
import time
import urllib.request

BASE = 'http://localhost:3000'
EMAIL, PASSWORD = 'docente@aulaviva.app', 'AulaViva2026'


def req(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    for k, v in (headers or {}).items():
        r.add_header(k, v)
    with urllib.request.urlopen(r) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


# 1) login admin
login = req('POST', '/api/auth/login', {'email': EMAIL, 'password': PASSWORD})
auth = {'Authorization': f"Bearer {login['token']}"}

# 2) crear demo
demo = req('POST', '/api/demo', None, auth)
sid, jc, ac = demo['id'], demo['joinCode'], demo['adminCode']
print('demo:', sid, jc, ac)

# 3) leer preguntas con configuración
mgmt = req('GET', f'/api/sessions/{sid}/manage', None, {'x-admin-code': ac})
questions = sorted(mgmt['questions'], key=lambda q: q['order'])
print('preguntas:', len(questions))

# 4) unir 4 participantes
parts = []
for name in ['Ana', 'Bruno', 'Caro', 'Diego']:
    p = req('POST', '/api/join', {'joinCode': jc, 'name': name})
    parts.append({'name': name, 'token': p['token']})
print('participantes:', len(parts))

NAMES = ['Ana', 'Bruno', 'Caro', 'Diego']

def answer(q, idx, part):
    t, cfg, payload = q['type'], q['config'], {}
    if t == 'multiple_choice':
        opts = cfg['options']
        payload = {'optionIds': [opts[idx % len(opts)]['id']]}
    elif t == 'semaforo':
        if cfg.get('mode') == 'single':
            payload = {'color': ['green', 'yellow', 'red', 'green'][idx % 4]}
        elif cfg.get('mode') == 'multi':
            payload = {'colorVotes': {item['id']: ['green', 'yellow', 'red', 'green'][(idx + j) % 4]
                                      for j, item in enumerate(cfg['items'])}}
        else:
            votes = {}
            for j, item in enumerate(cfg['items']):
                votes[item['id']] = ['valid', 'partial', 'invalid', 'valid'][(idx + j) % 4]
            payload = {'votes': votes}
    elif t == 'word_cloud':
        payload = {'words': [['equipo', 'practica'], ['aprendizaje'], ['diversion', 'equipo'], ['retos']][idx % 4]}
    elif t == 'decision_tree':
        nodes = {n['id']: n for n in cfg['nodes']}
        steps, node = [], nodes[cfg['rootId']]
        leaf = None
        while True:
            opt = node['options'][idx % len(node['options'])]
            steps.append({'nodeId': node['id'], 'optionId': opt['id']})
            if opt['nextId'] is None:
                leaf = opt['id']
                break
            node = nodes[opt['nextId']]
        payload = {'steps': steps, 'leafOptionId': leaf, 'comment': ['Muy útil el árbol', '', 'Me ayudó a decidir', ''][idx % 4]}
    elif t == 'open_text':
        payload = {'text': ['Me quedó la duda de cómo aplicar el método en mi carrera',
                            '¿Cuándo usamos el repaso espaciado?',
                            'No me quedó clara la parte práctica del tema visto',
                            'Ninguna duda, todo claro'][idx % 4]}
    elif t == 'diagnostico':
        values = {}
        for prompt in cfg['prompts']:
            k = prompt['inputType']
            if k == 'choice':
                values[prompt['id']] = prompt['options'][idx % len(prompt['options'])]
            elif k == 'scale':
                values[prompt['id']] = str([3, 4, 5, 2][idx % 4])
            else:
                values[prompt['id']] = [
                    'Para buscar información y redactar resúmenes de clase',
                    'Principalmente para programar y traducir textos',
                    'La uso casi nada, solo para dudas de estudio',
                    'Para hacer trabajos, traducciones y resumenes largos'][idx % 4]
        payload = {'values': values}
    req('POST', f"/api/questions/{q['id']}/answer", {'token': part['token'], 'payload': payload})


# 5) responder cada pregunta: abrirla, responder con los 4, revelar
for q in questions:
    req('PUT', f"/api/questions/{q['id']}", {'state': 'open'}, {'x-admin-code': ac})
    time.sleep(0.15)
    for i, part in enumerate(parts):
        answer(q, i, part)
    # verificación del bloqueo: reintento de Ana debe fallar con 409
    try:
        answer(q, 0, parts[0])
        print(f"  WARN {q['type']}: el reintento NO fue rechazado")
    except urllib.error.HTTPError as e:
        assert e.code == 409, e.code
    req('PUT', f"/api/questions/{q['id']}", {'state': 'revealed'}, {'x-admin-code': ac})
    print('ok', q['order'], q['type'])

print(json.dumps({'sid': sid, 'joinCode': jc, 'adminCode': ac}))
