// Connexion avec Google (OpenID Connect, flux « code » avec PKCE). Le navigateur ne voit jamais le secret du client :
// le serveur échange le code contre l'identité, directement avec Google.
import { createHash, randomBytes } from 'node:crypto'

export interface GoogleProfile {
  sub: string // identifiant stable du compte Google
  email: string
  emailVerified: boolean
}

export interface GoogleClient {
  authUrl(state: string, challenge: string): string
  /** Échange le code reçu au retour de Google contre l'identité ; null si Google refuse ou répond de travers. */
  exchange(code: string, verifier: string): Promise<GoogleProfile | null>
}

export const newOAuthSecret = () => randomBytes(32).toString('base64url')
export const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

interface Options {
  clientId: string
  clientSecret: string
  redirectUri: string
  fetchImpl?: typeof fetch // injectable pour les tests
}

export function createGoogleClient(o: Options): GoogleClient {
  const f = o.fetchImpl ?? fetch
  return {
    authUrl(state, challenge) {
      const q = new URLSearchParams({
        client_id: o.clientId,
        redirect_uri: o.redirectUri,
        response_type: 'code',
        scope: 'openid email', // le strict nécessaire : ni nom ni photo
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
    },
    async exchange(code, verifier) {
      try {
        const tok = await f('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: o.clientId,
            client_secret: o.clientSecret,
            redirect_uri: o.redirectUri,
            grant_type: 'authorization_code',
            code_verifier: verifier,
          }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!tok.ok) return null
        const accessToken = ((await tok.json()) as { access_token?: unknown }).access_token
        if (typeof accessToken !== 'string' || !accessToken) return null
        const info = await f('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
        })
        if (!info.ok) return null
        const j = (await info.json()) as { sub?: unknown; email?: unknown; email_verified?: unknown }
        if (typeof j.sub !== 'string' || !j.sub || typeof j.email !== 'string' || !j.email) return null
        return { sub: j.sub, email: j.email, emailVerified: j.email_verified === true }
      } catch {
        return null
      }
    },
  }
}
