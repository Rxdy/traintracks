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

// --- Mot de passe oublié -------------------------------------------------------------------------------------
const RESET_TTL_MS = 3600_000
const RESET_MIN_INTERVAL_MS = 60_000 // pas plus d'un e-mail par minute et par compte

// Réponse toujours identique, que l'adresse ait un compte ou non : on ne révèle pas qui est inscrit.
export async function forgotPassword(ctx: Ctx, input: { email: string }): Promise<void> {
  const email = normEmail(input.email)
  if (!EMAIL_RE.test(email) || email.length > 254) return
  const { rows } = await ctx.db.query<{ id: string; pseudo: string }>(
    'SELECT id, pseudo FROM users WHERE email = $1 AND password_hash IS NOT NULL',
    [email],
  )
  const u = rows[0]
  if (!u) return
  const now = ctx.now()
  const recent = await ctx.db.query('SELECT 1 FROM reset_tokens WHERE user_id = $1 AND created_at > $2', [u.id, new Date(now.getTime() - RESET_MIN_INTERVAL_MS)])
  if (recent.rows.length) return
  const token = newToken()
  await ctx.db.query('INSERT INTO reset_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)', [
    sha256(token),
    u.id,
    now,
    new Date(now.getTime() + RESET_TTL_MS),
  ])
  await ctx.mailer.send(
    email,
    'Train Tracks : nouveau mot de passe',
    `Bonjour ${u.pseudo},\n\nPour choisir un nouveau mot de passe (lien valable 1 h, utilisable une seule fois) :\n${ctx.appUrl}/?reset=${token}\n\nSi tu n'as rien demandé, ignore ce message : ton mot de passe ne change pas.\n`,
  )
}

export type ResetResult = { ok: true } | { ok: false; code: 'invalid_token' } | { ok: false; code: 'weak'; bits: number; min: number } | { ok: false; code: 'invalid' }

export async function resetPassword(ctx: Ctx, input: { token: string; password: string }): Promise<ResetResult> {
  if (!input.password || input.password.length > 200) return { ok: false, code: 'invalid' }
  const now = ctx.now()
  const hash = sha256(input.token)
  const found = await ctx.db.query<{ user_id: string; pseudo: string; email: string; expires_at: Date; used_at: Date | null }>(
    'SELECT t.user_id, u.pseudo, u.email, t.expires_at, t.used_at FROM reset_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1',
    [hash],
  )
  const r = found.rows[0]
  if (!r || r.used_at || new Date(r.expires_at) <= now) return { ok: false, code: 'invalid_token' }
  const bits = strengthBits(input.password, [r.pseudo, r.email, r.email.split('@')[0]])
  if (bits < MIN_BITS) return { ok: false, code: 'weak', bits, min: MIN_BITS }
  const newHash = await hashPassword(input.password)
  const done = await ctx.db.tx(async (t) => {
    // Le jeton ne sert qu'une fois, même si deux demandes arrivent en même temps.
    const used = await t.query('UPDATE reset_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL RETURNING user_id', [hash, now])
    if (!used.rows.length) return false
    await t.query('UPDATE users SET password_hash = $2, email_confirmed_at = COALESCE(email_confirmed_at, $3) WHERE id = $1', [r.user_id, newHash, now])
    await t.query('DELETE FROM sessions WHERE user_id = $1', [r.user_id]) // les appareils connectés doivent se reconnecter
    await t.query('DELETE FROM login_limits WHERE key = $1', [emailKey(r.email)])
    return true
  })
  if (!done) return { ok: false, code: 'invalid_token' }
  await ctx.mailer.send(r.email, 'Train Tracks : mot de passe modifié', `Ton mot de passe vient d'être modifié. Si ce n'est pas toi, demande un nouveau mot de passe sur ${ctx.appUrl}.\n`)
  return { ok: true }
}

// --- Suppression du compte (droit à l'effacement) ---------------------------------------------------------------
// Efface le compte ET toutes ses données : progression, pièces, aides, puzzle du jour, sessions, jetons.
export type DeleteResult = { ok: true } | { ok: false; code: 'invalid' } | { ok: false; code: 'locked'; retryAfterSec: number }

export async function deleteAccount(ctx: Ctx, input: { userId: string; password: string; ip: string }): Promise<DeleteResult> {
  const now = ctx.now()
  const { rows } = await ctx.db.query<{ email: string; password_hash: string | null }>('SELECT email, password_hash FROM users WHERE id = $1', [input.userId])
  const u = rows[0]
  if (!u) return { ok: false, code: 'invalid' }
  // Même blocage que la connexion : on ne peut pas deviner le mot de passe ici non plus.
  const keys = [emailKey(u.email), ipKey(input.ip)]
  const wait = await lockedFor(ctx.db, keys, now)
  if (wait > 0) return { ok: false, code: 'locked', retryAfterSec: wait }
  if (!u.password_hash || !(await checkPassword(u.password_hash, input.password))) {
    await recordFailure(ctx.db, emailKey(u.email), EMAIL_MAX_FAILS, now)
    await recordFailure(ctx.db, ipKey(input.ip), IP_MAX_FAILS, now)
    return { ok: false, code: 'invalid' }
  }
  const owner = `u:${input.userId}`
  await ctx.db.tx(async (t) => {
    for (const table of ['progress', 'level_runs', 'wallets', 'rewards', 'aid_stock', 'aid_gifts', 'daily_runs', 'daily_results']) {
      await t.query(`DELETE FROM ${table} WHERE owner = $1`, [owner])
    }
    await t.query('DELETE FROM login_limits WHERE key = $1', [emailKey(u.email)])
    await t.query('DELETE FROM users WHERE id = $1', [input.userId]) // sessions et jetons partent avec (ON DELETE CASCADE)
  })
  await ctx.mailer.send(u.email, 'Train Tracks : compte supprimé', 'Ton compte et toutes tes données ont été supprimés. À bientôt peut-être !\n')
  return { ok: true }
}
