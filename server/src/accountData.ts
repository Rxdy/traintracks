// Compte : changement d'adresse e-mail, export et import des données, préférence de classement.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { Ctx } from './auth.js'
import { checkOwnerPassword, emailKeyOf, newToken, normEmail, sha256 } from './auth.js'
import { canon } from './journey.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CHANGE_TTL_MS = 3600_000

// --- Changement d'adresse e-mail ------------------------------------------------------------------------------
export type ChangeRequest =
  | { ok: true }
  | { ok: false; code: 'invalid_email' | 'same' | 'email_taken' | 'wrong_password' }
  | { ok: false; code: 'locked'; retryAfterSec: number }

// L'adresse NE CHANGE PAS tout de suite : un lien est envoyé à la nouvelle boîte, et l'ancienne est prévenue.
export async function requestEmailChange(ctx: Ctx, input: { userId: string; password: string; newEmail: string; ip: string }): Promise<ChangeRequest> {
  const email = normEmail(input.newEmail)
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, code: 'invalid_email' }
  const pw = await checkOwnerPassword(ctx, input.userId, input.password, input.ip)
  if (!pw.ok) return pw.code === 'locked' ? pw : { ok: false, code: 'wrong_password' }
  if (emailKeyOf(email) === emailKeyOf(pw.email)) return { ok: false, code: 'same' }
  const taken = await ctx.db.query('SELECT 1 FROM users WHERE email_key = $1 AND id <> $2', [emailKeyOf(email), input.userId])
  if (taken.rows.length) return { ok: false, code: 'email_taken' }

  const now = ctx.now()
  const token = newToken()
  await ctx.db.tx(async (t) => {
    await t.query('DELETE FROM email_changes WHERE user_id = $1', [input.userId]) // une seule demande en cours
    await t.query('INSERT INTO email_changes (token_hash, user_id, new_email, created_at, expires_at) VALUES ($1,$2,$3,$4,$5)', [
      sha256(token), input.userId, email, now, new Date(now.getTime() + CHANGE_TTL_MS),
    ])
  })
  await ctx.mailer.send(email, 'Train Tracks : confirme ta nouvelle adresse', `Confirme que cette adresse est bien la tienne (lien valable 1 h) :\n${ctx.appUrl}/?email-change=${token}\n`)
  await ctx.mailer.send(pw.email, 'Train Tracks : changement d\'adresse demandé', `Un changement d'adresse e-mail vers ${email} vient d'être demandé pour ton compte. Il n'aura lieu que si cette nouvelle adresse est confirmée. Si ce n'est pas toi, change ton mot de passe sur ${ctx.appUrl}.\n`)
  return { ok: true }
}

export type ChangeConfirm = { ok: true } | { ok: false; code: 'invalid_token' | 'email_taken' }

export async function confirmEmailChange(ctx: Ctx, token: string): Promise<ChangeConfirm> {
  const now = ctx.now()
  const found = await ctx.db.query<{ user_id: string; new_email: string; expires_at: Date; used_at: Date | null }>(
    'SELECT user_id, new_email, expires_at, used_at FROM email_changes WHERE token_hash = $1', [sha256(token)])
  const r = found.rows[0]
  if (!r || r.used_at || new Date(r.expires_at) <= now) return { ok: false, code: 'invalid_token' }
  const old = (await ctx.db.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [r.user_id])).rows[0]?.email
  if (!old) return { ok: false, code: 'invalid_token' }
  try {
    const done = await ctx.db.tx(async (t) => {
      const used = await t.query('UPDATE email_changes SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL RETURNING user_id', [sha256(token), now])
      if (!used.rows.length) return false
      // la clé d'unicité se recalcule toute seule (migration 008) ; l'adresse est prouvée par le clic
      await t.query('UPDATE users SET email = $2, email_confirmed_at = $3 WHERE id = $1', [r.user_id, r.new_email, now])
      await t.query('DELETE FROM email_changes WHERE user_id = $1 AND token_hash <> $2', [r.user_id, sha256(token)])
      return true
    })
    if (!done) return { ok: false, code: 'invalid_token' }
  } catch (e) {
    if ((e as { code?: string }).code === '23505' || /unique|duplicate/i.test(String(e))) return { ok: false, code: 'email_taken' }
    throw e
  }
  await ctx.mailer.send(old, 'Train Tracks : adresse modifiée', `L'adresse de ton compte est maintenant ${r.new_email}. Si ce n'est pas toi, réponds à ce message ou contacte-nous.\n`)
  return { ok: true }
}

// --- Préférence : apparaître dans le classement ---------------------------------------------------------------
export async function setLeaderboard(ctx: Ctx, userId: string, visible: boolean): Promise<void> {
  await ctx.db.query('UPDATE users SET leaderboard = $2 WHERE id = $1', [userId, visible])
}

// --- Export et import -----------------------------------------------------------------------------------------
// Le fichier d'export est SIGNÉ par le serveur : on ne peut donc importer que des données qu'il a lui-même produites
// (pas de progression inventée à la main). Un fichier ne s'importe qu'une fois. Les pièces et aides ne sont pas
// importées (elles seraient dupliquées si on importait sur un autre compte) : elles figurent dans le fichier pour info.
export interface ExportPayload {
  format: 'traintracks-export'
  version: 1
  exportId: string
  exportedAt: string
  account: { pseudo: string; email: string; createdAt: string }
  journey: { level: number; timeMs: number; solvedAt: string }[]
  daily: { date: string; timeMs: number; solvedAt: string }[]
  wallet: { coins: number; aids: { id: string; qty: number }[] }
}
export type ExportFile = ExportPayload & { signature: string }

const sign = (secret: string, payload: ExportPayload) => createHmac('sha256', secret).update(canon(payload)).digest('hex')

export async function exportData(ctx: Ctx, userId: string, secret: string): Promise<ExportFile> {
  const owner = `u:${userId}`
  const u = (await ctx.db.query<{ pseudo: string; email: string; created_at: Date }>('SELECT pseudo, email, created_at FROM users WHERE id = $1', [userId])).rows[0]
  const prog = await ctx.db.query<{ level: number; time_ms: number; solved_at: Date }>('SELECT level, time_ms, solved_at FROM progress WHERE owner = $1 ORDER BY level', [owner])
  const daily = await ctx.db.query<{ date: string; time_ms: number; solved_at: Date }>('SELECT date, time_ms, solved_at FROM daily_results WHERE owner = $1 ORDER BY date', [owner])
  const coins = (await ctx.db.query<{ coins: number }>('SELECT coins FROM wallets WHERE owner = $1', [owner])).rows[0]?.coins ?? 0
  const aids = await ctx.db.query<{ aid: string; qty: number }>('SELECT aid, qty FROM aid_stock WHERE owner = $1 ORDER BY aid', [owner])
  const payload: ExportPayload = {
    format: 'traintracks-export',
    version: 1,
    exportId: randomUUID(),
    exportedAt: ctx.now().toISOString(),
    account: { pseudo: u.pseudo, email: u.email, createdAt: new Date(u.created_at).toISOString() },
    journey: prog.rows.map((r) => ({ level: r.level, timeMs: r.time_ms, solvedAt: new Date(r.solved_at).toISOString() })),
    daily: daily.rows.map((r) => ({ date: r.date, timeMs: r.time_ms, solvedAt: new Date(r.solved_at).toISOString() })),
    wallet: { coins, aids: aids.rows.map((r) => ({ id: r.aid, qty: r.qty })) },
  }
  return { ...payload, signature: sign(secret, payload) }
}

export type ImportResult =
  | { ok: true; levels: number; daily: number }
  | { ok: false; code: 'invalid_file' | 'bad_signature' | 'already_imported' }

const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length < 40 && !Number.isNaN(Date.parse(v))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function importData(ctx: Ctx, input: { userId: string; file: unknown; secret: string }): Promise<ImportResult> {
  const f = input.file as Partial<ExportFile> | null
  if (!f || typeof f !== 'object' || f.format !== 'traintracks-export' || f.version !== 1 || typeof f.signature !== 'string' || typeof f.exportId !== 'string' || f.exportId.length > 64) return { ok: false, code: 'invalid_file' }
  if (!Array.isArray(f.journey) || !Array.isArray(f.daily) || f.journey.length > 5000 || f.daily.length > 5000) return { ok: false, code: 'invalid_file' }
  for (const j of f.journey) if (!j || !isInt(j.level, 1, 100000) || !isInt(j.timeMs, 0, 24 * 3600_000) || !isIso(j.solvedAt)) return { ok: false, code: 'invalid_file' }
  for (const d of f.daily) if (!d || typeof d.date !== 'string' || !DATE_RE.test(d.date) || !isInt(d.timeMs, 0, 24 * 3600_000) || !isIso(d.solvedAt)) return { ok: false, code: 'invalid_file' }

  const { signature, ...payload } = f as ExportFile
  const expected = Buffer.from(sign(input.secret, payload as ExportPayload), 'hex')
  const given = Buffer.from(signature, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, code: 'bad_signature' }

  const owner = `u:${input.userId}`
  const now = ctx.now()
  return ctx.db.tx(async (t) => {
    const first = await t.query('INSERT INTO imports (export_id, user_id, imported_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING export_id', [f.exportId, input.userId, now])
    if (!first.rows.length) return { ok: false, code: 'already_imported' } as const
    let levels = 0
    for (const j of f.journey!) {
      // seulement les niveaux qui existent ; on garde toujours le MEILLEUR temps (jamais de recul)
      const r = await t.query(
        `INSERT INTO progress (owner, level, solved_at, time_ms) SELECT $1, id, $3, $4 FROM levels WHERE id = $2
         ON CONFLICT (owner, level) DO UPDATE SET time_ms = LEAST(progress.time_ms, EXCLUDED.time_ms) RETURNING level`,
        [owner, j.level, new Date(j.solvedAt), j.timeMs],
      )
      levels += r.rows.length
    }
    let daily = 0
    for (const d of f.daily!) {
      const r = await t.query('INSERT INTO daily_results (owner, date, time_ms, solved_at) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING date', [owner, d.date, d.timeMs, new Date(d.solvedAt)])
      daily += r.rows.length
    }
    return { ok: true, levels, daily } as const
  })
}
