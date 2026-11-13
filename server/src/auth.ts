// Comptes : inscription, confirmation d'e-mail, connexion (avec blocage), sessions.
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Db } from './db.js'
import type { Mailer } from './mailer.js'
import { MIN_BITS, checkPassword, dummyHash, hashPassword, strengthBits } from './password.js'
import { credit } from './wallet.js'
import { EMAIL_MAX_FAILS, IP_MAX_FAILS, emailKey, ipKey, lockedFor, recordFailure, recordSuccess } from './limits.js'

export interface Ctx {
  db: Db
  mailer: Mailer
  appUrl: string
  now: () => Date
}

export interface PublicUser {
  id: string
  pseudo: string
  email: string
  provider: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PSEUDO_RE = /^[\p{L}\p{N}_.-]+$/u
export const SIGNUP_COINS = 100
const CONFIRM_TTL_MS = 24 * 3600_000
const SESSION_TTL_MS = 30 * 24 * 3600_000

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')
export const normEmail = (e: string) => e.trim().toLowerCase()

export type RegisterResult =
  | { ok: true }
  | { ok: false; code: 'invalid'; field: 'pseudo' | 'email' | 'password' }
  | { ok: false; code: 'weak'; bits: number; min: number }
  | { ok: false; code: 'pseudo_taken' }

export async function register(ctx: Ctx, input: { pseudo: string; email: string; password: string }): Promise<RegisterResult> {
  const pseudo = input.pseudo.trim()
  const email = normEmail(input.email)
  if (pseudo.length < 2 || pseudo.length > 24 || !PSEUDO_RE.test(pseudo)) return { ok: false, code: 'invalid', field: 'pseudo' }
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, code: 'invalid', field: 'email' }
  if (!input.password || input.password.length > 200) return { ok: false, code: 'invalid', field: 'password' }

  const bits = strengthBits(input.password, [pseudo, email, email.split('@')[0]])
  if (bits < MIN_BITS) return { ok: false, code: 'weak', bits, min: MIN_BITS }

  const pseudoKey = pseudo.toLowerCase()
  const taken = await ctx.db.query('SELECT 1 FROM users WHERE pseudo_key = $1', [pseudoKey])
  if (taken.rows.length) return { ok: false, code: 'pseudo_taken' }

  // E-mail déjà inscrit : réponse identique à un succès (ne révèle pas qui a un compte) ; le titulaire est prévenu.
  const existing = await ctx.db.query('SELECT 1 FROM users WHERE email = $1', [email])
  if (existing.rows.length) {
    await ctx.mailer.send(email, 'Train Tracks : tu as déjà un compte', `Quelqu'un a tenté de s'inscrire avec cette adresse. Si c'est toi, connecte-toi sur ${ctx.appUrl}.`)
    return { ok: true }
  }

  const id = randomUUID()
  const token = newToken()
  const now = ctx.now()
  try {
    await ctx.db.tx(async (t) => {
      await t.query(
        'INSERT INTO users (id, pseudo, pseudo_key, email, password_hash, provider, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, pseudo, pseudoKey, email, await hashPassword(input.password), 'local', now],
      )
      await t.query('INSERT INTO email_tokens (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [
        sha256(token),
        id,
        new Date(now.getTime() + CONFIRM_TTL_MS),
      ])
    })
  } catch (e) {
    if ((e as { code?: string }).code === '23505' || /unique|duplicate/i.test(String(e))) return { ok: false, code: 'pseudo_taken' }
    throw e
  }
  await ctx.mailer.send(
    email,
    'Train Tracks : confirme ton adresse',
    `Bienvenue ${pseudo} !\n\nConfirme ton adresse (lien valable 24 h) :\n${ctx.appUrl}/?confirm=${token}\n`,
  )
  return { ok: true }
}

export async function confirmEmail(ctx: Ctx, token: string): Promise<{ ok: true; userId: string } | { ok: false }> {
  const now = ctx.now()
  return ctx.db.tx(async (t) => {
    const { rows } = await t.query<{ user_id: string; expires_at: Date; used_at: Date | null }>(
      'SELECT user_id, expires_at, used_at FROM email_tokens WHERE token_hash = $1 FOR UPDATE',
      [sha256(token)],
    )
    const r = rows[0]
    if (!r || r.used_at || new Date(r.expires_at) <= now) return { ok: false } as const
    await t.query('UPDATE email_tokens SET used_at = $2 WHERE token_hash = $1', [sha256(token), now])
    await t.query('UPDATE users SET email_confirmed_at = COALESCE(email_confirmed_at, $2) WHERE id = $1', [r.user_id, now])
    // 100 pièces de bienvenue, versées une seule fois, à la confirmation de l'e-mail.
    await credit(t, `u:${r.user_id}`, SIGNUP_COINS, 'signup', 'email', now)
    return { ok: true, userId: r.user_id } as const
  })
}

export type LoginResult =
  | { ok: true; user: PublicUser; sessionToken: string }
  | { ok: false; code: 'locked'; retryAfterSec: number }
  | { ok: false; code: 'invalid' }
  | { ok: false; code: 'unconfirmed' }

export async function login(ctx: Ctx, input: { email: string; password: string; ip: string }): Promise<LoginResult> {
  const email = normEmail(input.email)
  const keys = [emailKey(email), ipKey(input.ip)]
  const now = ctx.now()

  const wait = await lockedFor(ctx.db, keys, now)
  if (wait > 0) return { ok: false, code: 'locked', retryAfterSec: wait }

  const { rows } = await ctx.db.query<{ id: string; pseudo: string; email: string; provider: string; password_hash: string | null; email_confirmed_at: Date | null }>(
    'SELECT id, pseudo, email, provider, password_hash, email_confirmed_at FROM users WHERE email = $1',
    [email],
  )
  const u = rows[0]
  // Même travail qu'il y ait un compte ou non : le temps de réponse ne révèle rien.
  const good = await checkPassword(u?.password_hash ?? (await dummyHash()), input.password)
  if (!u || !u.password_hash || !good) {
    await recordFailure(ctx.db, emailKey(email), EMAIL_MAX_FAILS, now)
    await recordFailure(ctx.db, ipKey(input.ip), IP_MAX_FAILS, now)
    return { ok: false, code: 'invalid' }
  }
  if (!u.email_confirmed_at) return { ok: false, code: 'unconfirmed' }

  await recordSuccess(ctx.db, emailKey(email))
  const token = newToken()
  await ctx.db.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)', [
    sha256(token),
    u.id,
    now,
    new Date(now.getTime() + SESSION_TTL_MS),
  ])
  return { ok: true, user: { id: u.id, pseudo: u.pseudo, email: u.email, provider: u.provider }, sessionToken: token }
}

export async function userForSession(ctx: Ctx, token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null
  const { rows } = await ctx.db.query<PublicUser>(
    `SELECT u.id, u.pseudo, u.email, u.provider FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [sha256(token), ctx.now()],
  )
  return rows[0] ?? null
}

export async function logout(ctx: Ctx, token: string | undefined): Promise<void> {
  if (token) await ctx.db.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)])
}
