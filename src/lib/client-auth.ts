// Respaldo de sesión en el cliente: el token del docente se guarda en
// localStorage y se envía como "Authorization: Bearer" en cada llamada del
// panel. Necesario porque dentro de iframes de otro dominio los navegadores
// bloquean cookies de terceros y la sesión se perdía al recargar.
const TOKEN_KEY = 'aulaviva_session_token'

export function saveAuthToken(token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* almacenamiento no disponible: queda solo la cookie */
  }
}

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearAuthToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nada que limpiar */
  }
}

// fetch con la cabecera Bearer adjunta (y sin caché) para las APIs del panel.
export function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {})
  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...init, headers, cache: 'no-store' })
}
