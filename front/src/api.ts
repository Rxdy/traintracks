// Appels au serveur (/api). Le navigateur ne connaît ni les solutions ni les niveaux à venir.
export interface ApiReply {
  status: number
  data: Record<string, unknown>
  retryAfter: number
}

export async function api(method: 'GET' | 'POST', path: string, body?: object): Promise<ApiReply | null> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { status: res.status, data, retryAfter: Number(res.headers.get('retry-after') ?? 0) }
  } catch {
    return null // serveur injoignable (hors ligne)
  }
}
