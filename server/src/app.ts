import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import { confirmEmail, deleteAccount, forgotPassword, login, logout, register, resetPassword, userForSession, type Ctx } from './auth.js'
import { MIN_BITS } from './password.js'
import { begin, mergeAnonymous, start, status, submit } from './journey.js'
import { aidState, buyAid, useAid } from './aids.js'
import { beginDaily, dailyStats, dailyStatus, dateKey, startDaily, submitDaily } from './daily.js'
import { randomUUID } from 'node:crypto'

const COOKIE = 'tt_session'
const ANON = 'tt_anon' // identifiant d'un joueur pas encore inscrit : sa progression est gardée côté serveur
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const COOKIE_MAX_AGE = 30 * 24 * 3600

export interface AppOptions extends Ctx {
  secureCookies?: boolean
  trustProxy?: boolean
  dailyTz?: string // fuseau horaire qui définit « aujourd'hui » pour le puzzle du jour
  legal?: LegalInfo // éditeur, contact et hébergeur affichés dans les mentions légales
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
    return { journey: await status(opts.db, owner), daily: await dailyStats(opts.db, owner, today()) }
  })

  app.get('/api/auth/policy', async () => ({ minBits: MIN_BITS }))
  return app
}
