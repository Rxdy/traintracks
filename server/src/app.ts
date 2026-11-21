import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import { changePassword, confirmEmail, deleteAccount, forgotPassword, googleSignIn, login, logout, register, resetPassword, userForSession, type Ctx } from './auth.js'
import { MIN_BITS } from './password.js'
import { challengeOf, newOAuthSecret, type GoogleClient } from './google.js'
import { begin, mergeAnonymous, start, status, submit } from './journey.js'
import { aidState, buyAid, useAid } from './aids.js'
import { beginDaily, dailyStats, dailyStatus, dateKey, startDaily, submitDaily } from './daily.js'
import { randomUUID } from 'node:crypto'
import { confirmEmailChange, exportData, importData, requestEmailChange, changePseudo, setLeaderboard } from './accountData.js'
import { completeTutorial } from './tutorial.js'
import { avatarState, buyAvatar, selectAvatar } from './avatars.js'
import { drawWagon, selectPreset, setTrain, trainState } from './wagons.js'
import { journeyStats, leaderboard, type Board } from './stats.js'

const COOKIE = 'tt_session'
const ANON = 'tt_anon' // identifiant d'un joueur pas encore inscrit : sa progression est gardée côté serveur
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const COOKIE_MAX_AGE = 30 * 24 * 3600
const OAUTH = 'tt_oauth' // état et vérificateur PKCE d'une connexion Google en cours (10 minutes)

export interface AppOptions extends Ctx {
  secureCookies?: boolean
  trustProxy?: boolean
  dailyTz?: string // fuseau horaire qui définit « aujourd'hui » pour le puzzle du jour
  exportSecret?: string // clé qui signe les fichiers d'export (EXPORT_SECRET)
  legal?: LegalInfo // éditeur, contact et hébergeur affichés dans les mentions légales
  google?: GoogleClient // connexion avec Google ; absent : la fonction est désactivée (bouton masqué)
}

export interface LegalInfo {
  name: string
  contact: string
  host: string
}

type Body = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function buildApp(opts: AppOptions): FastifyInstance {
  const app = Fastify({ trustProxy: opts.trustProxy ?? false, bodyLimit: 10_000 })
  app.register(cookie)
  const ctx: Ctx = opts

  const setSession = (reply: FastifyReply, token: string) =>
    reply.setCookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies ?? false,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })

  app.get('/api/health', async () => ({ ok: true }))
  // Version du build, posée par la CI dans l'image (APP_VERSION = tag vX.Y.Z, APP_COMMIT) ; « dev » en local.
  app.get('/api/version', async () => ({ version: process.env.APP_VERSION || 'dev', commit: process.env.APP_COMMIT || '' }))

  app.post('/api/auth/register', async (req, reply) => {
    const b = (req.body ?? {}) as Body
    const r = await register(ctx, { pseudo: str(b.pseudo), email: str(b.email), password: str(b.password) })
    if (r.ok) return reply.code(201).send({ ok: true })
    if (r.code === 'invalid') return reply.code(400).send({ error: 'invalid', field: r.field })
    if (r.code === 'weak') return reply.code(422).send({ error: 'weak', bits: r.bits, min: r.min })
    return reply.code(409).send({ error: r.code }) // 'pseudo_taken' ou 'email_taken'
  })

  app.post('/api/auth/confirm', async (req, reply) => {
    const r = await confirmEmail(ctx, str(((req.body ?? {}) as Body).token))
    return r.ok ? { ok: true } : reply.code(400).send({ error: 'invalid_token' })
  })

  app.post('/api/auth/login', async (req, reply) => {
    const b = (req.body ?? {}) as Body
    const r = await login(ctx, { email: str(b.email), password: str(b.password), ip: req.ip })
    if (r.ok) {
      setSession(reply, r.sessionToken)
      const anon = req.cookies[ANON]
      if (anon && UUID_RE.test(anon)) {
        await mergeAnonymous(opts.db, anon, r.user.id)
        reply.clearCookie(ANON, { path: '/' })
      }
      return { ok: true, user: r.user }
    }
    if (r.code === 'locked') return reply.code(429).header('Retry-After', String(r.retryAfterSec)).send({ error: 'locked', retryAfterSec: r.retryAfterSec })
    if (r.code === 'unconfirmed') return reply.code(403).send({ error: 'unconfirmed' })
    return reply.code(401).send({ error: 'invalid' })
  })

  // --- Connexion avec Google --------------------------------------------------------------------------------
  app.get('/api/auth/providers', async () => ({ google: !!opts.google }))
  app.get('/api/auth/google/start', async (req, reply) => {
    if (!opts.google) return reply.code(404).send({ error: 'google_off' })
    const state = newOAuthSecret()
    const verifier = newOAuthSecret()
    reply.setCookie(OAUTH, `${state}.${verifier}`, { httpOnly: true, sameSite: 'lax', secure: opts.secureCookies ?? false, path: '/api/auth/google', maxAge: 600 })
    return reply.redirect(opts.google.authUrl(state, challengeOf(verifier)))
  })
  app.get('/api/auth/google/callback', async (req, reply) => {
    const fail = (code: string) => reply.clearCookie(OAUTH, { path: '/api/auth/google' }).redirect(`${opts.appUrl}/?auth_error=${code}`)
    if (!opts.google) return reply.code(404).send({ error: 'google_off' })
    const q = (req.query ?? {}) as Record<string, unknown>
    const [state, verifier] = (req.cookies[OAUTH] ?? '').split('.')
    // L'état doit revenir à l'identique : il prouve que cette connexion a bien été lancée depuis ce navigateur.
    if (!state || !verifier || str(q.state) !== state || !str(q.code)) return fail('google')
    const profile = await opts.google.exchange(str(q.code), verifier)
    if (!profile) return fail('google')
    const r = await googleSignIn(ctx, profile)
    if (!r.ok) return fail('google_email')
    setSession(reply, r.sessionToken)
    reply.clearCookie(OAUTH, { path: '/api/auth/google' })
    const anon = req.cookies[ANON]
    if (anon && UUID_RE.test(anon)) {
      await mergeAnonymous(opts.db, anon, r.user.id)
      reply.clearCookie(ANON, { path: '/' })
    }
    // Compte tout juste créé par Google : il a reçu un pseudo tiré au hasard, le site lui propose aussitôt d'en choisir un.
    return reply.redirect(`${opts.appUrl}/${r.created ? '?bienvenue=1' : ''}`)
  })

  // Mot de passe oublié : la réponse est la même que l'adresse ait un compte ou non.
  app.post('/api/auth/forgot', async (req) => {
    await forgotPassword(ctx, { email: str(((req.body ?? {}) as Body).email) })
    return { ok: true }
  })

  app.post('/api/auth/reset', async (req, reply) => {
    const b = (req.body ?? {}) as Body
    const r = await resetPassword(ctx, { token: str(b.token), password: str(b.password) })
    if (r.ok) return { ok: true }
    if (r.code === 'weak') return reply.code(422).send({ error: 'weak', bits: r.bits, min: r.min })
    return reply.code(400).send({ error: r.code })
  })

  // Droit à l'effacement : le compte et toutes ses données, après confirmation par le mot de passe.
  app.post('/api/auth/delete-account', async (req, reply) => {
    const user = await userForSession(ctx, req.cookies[COOKIE])
    if (!user) return reply.code(401).send({ error: 'unauthenticated' })
    const r = await deleteAccount(ctx, { userId: user.id, password: str(((req.body ?? {}) as Body).password), ip: req.ip })
    if (r.ok) {
      reply.clearCookie(COOKIE, { path: '/' })
      return { ok: true }
    }
    if (r.code === 'locked') return reply.code(429).header('Retry-After', String(r.retryAfterSec)).send({ error: 'locked', retryAfterSec: r.retryAfterSec })
    return reply.code(403).send({ error: 'invalid' })
  })

  app.get('/api/legal', async () => opts.legal ?? { name: '', contact: '', host: '' })

  app.post('/api/auth/logout', async (req, reply) => {
    await logout(ctx, req.cookies[COOKIE])
    reply.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  app.get('/api/me', async (req, reply) => {
    const user = await userForSession(ctx, req.cookies[COOKIE])
    return user ? { user } : reply.code(401).send({ error: 'unauthenticated' })
  })

  // --- Voyage ---------------------------------------------------------------------------------------------
  // Qui joue : le joueur connecté, sinon un identifiant anonyme (cookie) créé au besoin.
  async function ownerOf(req: FastifyRequest, reply: FastifyReply, create: boolean): Promise<string | null> {
    const user = await userForSession(ctx, req.cookies[COOKIE])
    if (user) return `u:${user.id}`
    let anon = req.cookies[ANON]
    if (!anon || !UUID_RE.test(anon)) {
      if (!create) return null
      anon = randomUUID()
      reply.setCookie(ANON, anon, { httpOnly: true, sameSite: 'lax', secure: opts.secureCookies ?? false, path: '/', maxAge: 365 * 24 * 3600 })
    }
    return `a:${anon}`
  }

  app.get('/api/journey', async (req, reply) => {
    const owner = await ownerOf(req, reply, false)
    return status(opts.db, owner ?? 'a:nouveau')
  })

  app.post('/api/journey/start', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    return start(opts.db, owner, opts.now())
  })

  // Premier geste du joueur : c'est de là que son temps compte (le temps de lecture de la grille n'en fait pas partie).
  app.post('/api/journey/begin', async (req, reply) => {
    const owner = await ownerOf(req, reply, true)
    return { ok: await begin(opts.db, owner!, opts.now()) }
  })

  app.post('/api/journey/submit', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const b = (req.body ?? {}) as Body
    const r = await submit(opts.db, owner, { level: b.level, edges: b.edges }, opts.now())
    if (r.ok) return r
    return reply.code(r.code === 'wrong' ? 422 : r.code === 'invalid' ? 400 : 409).send({ ok: false, error: r.code })
  })

  app.post('/api/tutorial/complete', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const r = await completeTutorial(opts.db, owner, ((req.body ?? {}) as Body).edges, opts.now())
    if (r.ok) return r
    return reply.code(r.code === 'wrong' ? 422 : 400).send({ ok: false, error: r.code })
  })

  // --- Pièces et aides -------------------------------------------------------------------------------------
  app.get('/api/aids', async (req, reply) => {
    const owner = await ownerOf(req, reply, false)
    return aidState(opts.db, owner ?? 'a:nouveau')
  })

  app.post('/api/aids/buy', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const r = await buyAid(opts.db, owner, ((req.body ?? {}) as Body).aid)
    if (r.ok) return r
    return reply.code(r.code === 'poor' ? 402 : r.code === 'invalid' ? 400 : r.code === 'locked' ? 403 : 409).send({ ok: false, error: r.code })
  })

  // --- Le train : collection de wagons, machine « Wagon surprise », ordre des wagons ---------------------------
  app.get('/api/train', async (req, reply) => trainState(opts.db, await ownerOf(req, reply, false)))

  app.post('/api/train/draw', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const r = await drawWagon(opts.db, owner, opts.now())
    if (r.ok) return r
    return reply.code(r.code === 'poor' ? 402 : 409).send({ ok: false, error: r.code })
  })

  app.post('/api/train/layout', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const b = (req.body ?? {}) as Body
    const r = await setTrain(opts.db, owner, b.cars, opts.now(), b.slot)
    if (r.ok) return r
    return reply.code(400).send({ ok: false, error: r.code })
  })

  app.post('/api/train/active', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const r = await selectPreset(opts.db, owner, ((req.body ?? {}) as Body).slot, opts.now())
    if (r.ok) return r
    return reply.code(400).send({ ok: false, error: r.code })
  })

  app.post('/api/journey/aid', async (req, reply) => {
    const owner = (await ownerOf(req, reply, true))!
    const b = (req.body ?? {}) as Body
    const r = await useAid(opts.db, owner, { aid: b.aid, target: b.target, edges: b.edges, crosses: b.crosses })
    if (r.ok) return r
    const http = { invalid: 400, locked: 403, no_stock: 402 }[r.code as 'invalid' | 'locked' | 'no_stock'] ?? 409
    return reply.code(http).send({ ok: false, error: r.code })
  })

  // --- Puzzle du jour et statistiques : réservés aux joueurs inscrits -----------------------------------------
  const today = () => dateKey(opts.now(), opts.dailyTz ?? 'Europe/Paris')
  async function accountOf(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const user = await userForSession(ctx, req.cookies[COOKIE])
    if (!user) {
      reply.code(401).send({ error: 'unauthenticated' })
      return null
    }
    return `u:${user.id}`
  }

  app.get('/api/daily', async (req, reply) => {
    const owner = await accountOf(req, reply)
    return owner ? dailyStatus(opts.db, owner, today()) : undefined
  })

  app.post('/api/daily/start', async (req, reply) => {
    const owner = await accountOf(req, reply)
    return owner ? startDaily(opts.db, owner, today(), opts.now()) : undefined
  })

  app.post('/api/daily/begin', async (req, reply) => {
    const owner = await accountOf(req, reply)
    return owner ? { ok: await beginDaily(opts.db, owner, today(), opts.now()) } : undefined
  })

  app.post('/api/daily/submit', async (req, reply) => {
    const owner = await accountOf(req, reply)
    if (!owner) return
    const r = await submitDaily(opts.db, owner, today(), ((req.body ?? {}) as Body).edges, opts.now())
    if (r.ok) return r
    return reply.code(r.code === 'wrong' ? 422 : r.code === 'invalid' ? 400 : 409).send({ ok: false, error: r.code })
  })

  app.get('/api/stats', async (req, reply) => {
    const owner = await accountOf(req, reply)
    if (!owner) return
    return { journey: { ...(await status(opts.db, owner)), ...(await journeyStats(opts.db, owner)) }, daily: await dailyStats(opts.db, owner, today()) }
  })

  // --- Classements : publics en lecture (pseudo seulement) ; « ma place » si on est connecté ---
  app.get('/api/leaderboard', async (req, reply) => {
    const board = String(((req.query ?? {}) as Body).board ?? 'voyage') as Board
    if (!['voyage', 'jour', 'serie'].includes(board)) return reply.code(400).send({ error: 'invalid' })
    const user = await userForSession(ctx, req.cookies[COOKIE])
    return leaderboard(opts.db, board, today(), user?.id ?? null)
  })

  // --- Compte : changement d'adresse, préférence de classement, export / import ---
  async function userOrFail(req: FastifyRequest, reply: FastifyReply) {
    const user = await userForSession(ctx, req.cookies[COOKIE])
    if (!user) reply.code(401).send({ error: 'unauthenticated' })
    return user
  }
  app.post('/api/account/email', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const b = (req.body ?? {}) as Body
    const r = await requestEmailChange(ctx, { userId: user.id, password: str(b.password), newEmail: str(b.email), ip: req.ip })
    if (r.ok) return { ok: true }
    if (r.code === 'locked') return reply.code(429).header('Retry-After', String(r.retryAfterSec)).send({ error: 'locked', retryAfterSec: r.retryAfterSec })
    return reply.code(r.code === 'email_taken' ? 409 : r.code === 'wrong_password' ? 403 : 400).send({ error: r.code })
  })
  app.post('/api/account/password', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const b = (req.body ?? {}) as Body
    const r = await changePassword(ctx, {
      userId: user.id,
      currentPassword: str(b.currentPassword),
      newPassword: str(b.newPassword),
      ip: req.ip,
      sessionToken: req.cookies[COOKIE],
    })
    if (r.ok) return { ok: true }
    if (r.code === 'locked') return reply.code(429).header('Retry-After', String(r.retryAfterSec)).send({ error: 'locked', retryAfterSec: r.retryAfterSec })
    if (r.code === 'weak') return reply.code(400).send({ error: 'weak', bits: r.bits, min: r.min })
    return reply.code(r.code === 'wrong_password' ? 403 : 400).send({ error: r.code })
  })
  app.post('/api/account/email/confirm', async (req, reply) => {
    const r = await confirmEmailChange(ctx, str(((req.body ?? {}) as Body).token))
    if (r.ok) return { ok: true }
    return reply.code(r.code === 'email_taken' ? 409 : 400).send({ error: r.code })
  })
  // --- Avatars : une liste fixe ; les payants s'achètent avec les pièces ---
  app.get('/api/avatars', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    return avatarState(opts.db, user.id)
  })
  app.post('/api/avatars/buy', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const r = await buyAvatar(opts.db, user.id, ((req.body ?? {}) as Body).id, ctx.now())
    if (r.ok) return { ok: true, ...(await avatarState(opts.db, user.id)) }
    return reply.code(r.code === 'owned' ? 409 : r.code === 'poor' ? 402 : 400).send({ error: r.code })
  })
  app.post('/api/avatars/select', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const r = await selectAvatar(opts.db, user.id, ((req.body ?? {}) as Body).id)
    if (r.ok) return { ok: true, ...(await avatarState(opts.db, user.id)) }
    return reply.code(r.code === 'not_owned' ? 403 : 400).send({ error: r.code })
  })
  app.post('/api/account/pseudo', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const r = await changePseudo(ctx, user.id, str(((req.body ?? {}) as Body).pseudo))
    if (!r.ok) return reply.code(r.code === 'invalid' ? 400 : 409).send({ error: r.code })
    return r
  })
  app.post('/api/account/leaderboard', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const v = ((req.body ?? {}) as Body).visible
    if (typeof v !== 'boolean') return reply.code(400).send({ error: 'invalid' })
    await setLeaderboard(ctx, user.id, v)
    return { ok: true, visible: v }
  })
  const SECRET = opts.exportSecret ?? 'dev-export-secret-change-me'
  app.get('/api/account/export', async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    reply.header('Content-Disposition', `attachment; filename="train-tracks-${user.pseudo}.json"`)
    return exportData(ctx, user.id, SECRET)
  })
  app.post('/api/account/import', { bodyLimit: 1_000_000 }, async (req, reply) => {
    const user = await userOrFail(req, reply)
    if (!user) return
    const r = await importData(ctx, { userId: user.id, file: req.body, secret: SECRET })
    if (r.ok) return r
    return reply.code(r.code === 'already_imported' ? 409 : r.code === 'bad_signature' ? 403 : 400).send({ error: r.code })
  })

  app.get('/api/auth/policy', async () => ({ minBits: MIN_BITS }))
  return app
}
