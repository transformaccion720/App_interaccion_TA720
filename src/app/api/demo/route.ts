// POST /api/demo — crea una sesión de demostración con preguntas de ejemplo.
// SOLO disponible para el administrador (rol ADMIN): no se expone al público.
import { db } from '@/lib/db'
import { generateCode } from '@/lib/codes'
import { jsonError } from '@/lib/api-helpers'
import { getAuthTeacherWithRole } from '@/lib/auth'

export async function POST() {
  try {
    const teacher = await getAuthTeacherWithRole('ADMIN')
    if (!teacher) return jsonError('La demo solo está disponible para el administrador', 403)

    let joinCode = ''
    let adminCode = ''
    for (let attempt = 0; attempt < 10; attempt++) {
      const jc = generateCode(6)
      const ac = generateCode(8)
      const [existsJ, existsA] = await Promise.all([
        db.session.findUnique({ where: { joinCode: jc } }),
        db.session.findUnique({ where: { adminCode: ac } }),
      ])
      if (!existsJ && !existsA) {
        joinCode = jc
        adminCode = ac
        break
      }
    }
    if (!joinCode) return jsonError('No se pudo generar el código', 500)

    const id = (v: string) => `d_${v}_${Math.random().toString(36).slice(2, 8)}`

    // --- Árbol de decisiones de ejemplo: ¿Qué método de estudio me conviene? ---
    const n1 = id('n1'), n2 = id('n2'), n3 = id('n3')
    const leafA = id('la'), leafB = id('lb'), leafC = id('lc'), leafD = id('ld')

    const demoQuestions = [
      {
        order: 0,
        title: '¿Qué tipo de contenido prefieres para repasar el tema de hoy?',
        description: 'Elige una opción. Puedes cambiar tu respuesta mientras esté abierta.',
        type: 'multiple_choice',
        config: JSON.stringify({
          options: [
            { id: id('o'), text: 'Videos explicativos', correct: false },
            { id: id('o'), text: 'Resúmenes escritos', correct: false },
            { id: id('o'), text: 'Ejercicios prácticos', correct: false },
            { id: id('o'), text: 'Debate en grupo', correct: false },
          ],
          multipleSelect: false,
          showCorrect: false,
        }),
      },
      {
        order: 1,
        title: 'Semáforo: evalúa estas afirmaciones sobre el trabajo en equipo',
        description: 'Marca cada afirmación como Válida, Parcial o No válida.',
        type: 'semaforo',
        config: JSON.stringify({
          items: [
            { id: id('i'), text: 'Dividir tareas según las fortalezas de cada integrante mejora los resultados' },
            { id: id('i'), text: 'Un buen equipo nunca tiene desacuerdos' },
            { id: id('i'), text: 'La comunicación constante evita retrabajos' },
          ],
          allowPartial: true,
        }),
      },
      {
        order: 2,
        title: 'Lluvia de ideas: ¿qué palabra describe lo que esperas de esta clase?',
        description: 'Escribe hasta 3 palabras clave cortas.',
        type: 'word_cloud',
        config: JSON.stringify({ maxWords: 3 }),
      },
      {
        order: 3,
        title: 'Árbol de decisiones: ¿qué técnica de estudio te conviene?',
        description: 'Responde las preguntas y llega a una recomendación. Al final puedes dejar un comentario.',
        type: 'decision_tree',
        config: JSON.stringify({
          rootId: n1,
          nodes: [
            {
              id: n1,
              text: '¿Cuántos días tienes antes del examen?',
              options: [
                { id: id('o'), label: 'Más de una semana', nextId: n2 },
                { id: id('o'), label: 'Una semana o menos', nextId: n3 },
              ],
            },
            {
              id: n2,
              text: '¿Prefieres estudiar solo o acompañado?',
              options: [
                { id: id('o'), label: 'Solo', nextId: leafA },
                { id: id('o'), label: 'Acompañado', nextId: leafB },
              ],
            },
            {
              id: n3,
              text: '¿El examen es más teórico o práctico?',
              options: [
                { id: id('o'), label: 'Teórico', nextId: leafC },
                { id: id('o'), label: 'Práctico', nextId: leafD },
              ],
            },
            {
              id: leafA,
              text: 'Recomendación: plan de repaso espaciado con mapas conceptuales por tema, 45 min diarios.',
              options: [{ id: id('o'), label: 'Repaso espaciado + mapas conceptuales', nextId: null }],
            },
            {
              id: leafB,
              text: 'Recomendación: grupo de estudio con turnos de enseñanza (cada uno explica un tema) y quiz mutuo.',
              options: [{ id: id('o'), label: 'Grupo de estudio + quiz mutuo', nextId: null }],
            },
            {
              id: leafC,
              text: 'Recomendación: técnica Pomodoro con fichas de repaso activo (pregunta-respuesta).',
              options: [{ id: id('o'), label: 'Pomodoro + fichas de repaso', nextId: null }],
            },
            {
              id: leafD,
              text: 'Recomendación: práctica intensiva de ejercicios de exámenes anteriores y corrección guiada.',
              options: [{ id: id('o'), label: 'Práctica intensiva de ejercicios', nextId: null }],
            },
          ],
        }),
      },
      {
        order: 4,
        title: '¿Qué duda te quedó de la clase de hoy?',
        description: 'Escribe tu pregunta con tus propias palabras (máx. 300 caracteres).',
        type: 'open_text',
        config: JSON.stringify({ maxLength: 300 }),
      },
      {
        order: 5,
        title: 'Diagnóstico situacional: tu experiencia con la IA',
        description: 'Responde con sinceridad: verás gráficos con los resultados del grupo en vivo.',
        type: 'diagnostico',
        config: JSON.stringify({
          prompts: [
            {
              id: id('p'),
              label: '¿Cuánto has usado la IA hasta hoy?',
              inputType: 'choice',
              options: ['Nunca', 'Poco', 'Regular', 'Frecuentemente', 'A diario'],
            },
            {
              id: id('p'),
              label: '¿Para qué la usas principalmente?',
              inputType: 'text',
              placeholder: 'Ej.: para buscar información, redactar, programar…',
              maxLength: 300,
            },
            {
              id: id('p'),
              label: '¿Qué tan seguro/a te sientes al usarla?',
              inputType: 'scale',
              minLabel: 'Nada seguro/a',
              maxLabel: 'Muy seguro/a',
            },
            {
              id: id('p'),
              label: '¿Cuáles son tus principales preocupaciones sobre la IA?',
              inputType: 'text',
              placeholder: 'Ej.: privacidad, dependencia, exactitud…',
              maxLength: 300,
            },
            {
              id: id('p'),
              label: '¿Qué esperas de este curso?',
              inputType: 'text',
              placeholder: 'Cuéntanos qué te gustaría aprender…',
              maxLength: 300,
            },
          ],
        }),
      },
    ]

    const session = await db.session.create({
      data: {
        title: 'Clase de demostración — Transform Acción 720',
        description: 'Sesión de ejemplo con los 6 tipos de interacción, incluido el diagnóstico situacional. ¡Pruébala compartiendo el código con tus alumnos!',
        joinCode,
        adminCode,
        maxParticipants: 100,
        status: 'draft',
        teacherId: teacher.id,
        questions: { create: demoQuestions },
      },
    })

    return Response.json({
      id: session.id,
      joinCode: session.joinCode,
      adminCode: session.adminCode,
    })
  } catch {
    return jsonError('No se pudo crear la demo', 500)
  }
}
