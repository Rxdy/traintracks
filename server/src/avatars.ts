// Avatars : choisir parmi la liste fixe, acheter les payants avec les pièces. Le serveur fait foi (prix, possession).
import { randomInt } from 'node:crypto'
import { avatarOf, FREE_AVATARS } from '../../shared/avatars.js'
import type { Db } from './db.js'
import { balance, spend } from './wallet.js'

/** Avatar donné à un nouveau compte : un des gratuits, au hasard (pour que les joueurs ne se ressemblent pas tous). */
export const randomFreeAvatar = (): string => FREE_AVATARS[randomInt(FREE_AVATARS.length)]

export interface AvatarState {
  current: string
  owned: string[] // les avatars achetés (les gratuits sont à tout le monde)
  coins: number
}

export async function avatarState(db: Db, userId: string): Promise<AvatarState> {
  const cur = await db.query<{ avatar: string }>('SELECT avatar FROM users WHERE id = $1', [userId])
  const owned = await db.query<{ avatar: string }>('SELECT avatar FROM avatars_owned WHERE user_id = $1 ORDER BY created_at, avatar', [userId])
  return { current: cur.rows[0]?.avatar ?? FREE_AVATARS[0], owned: owned.rows.map((r) => r.avatar), coins: await balance(db, `u:${userId}`) }
}

export type BuyAvatarResult = { ok: true; coins: number } | { ok: false; code: 'invalid' | 'free' | 'owned' | 'poor' }

export async function buyAvatar(db: Db, userId: string, id: unknown, now: Date): Promise<BuyAvatarResult> {
  const def = avatarOf(id)
  if (!def) return { ok: false, code: 'invalid' }
  if (def.price === 0) return { ok: false, code: 'free' }
  return db.tx(async (t) => {
    // Une seule opération d'achat à la fois par joueur : deux clics rapides ne débitent jamais deux fois.
    const u = await t.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId])
    if (!u.rows.length) return { ok: false, code: 'invalid' } as const
    const has = await t.query('SELECT 1 FROM avatars_owned WHERE user_id = $1 AND avatar = $2', [userId, def.id])
    if (has.rows.length) return { ok: false, code: 'owned' } as const
    if (!(await spend(t, `u:${userId}`, def.price))) return { ok: false, code: 'poor' } as const
    await t.query('INSERT INTO avatars_owned (user_id, avatar, created_at) VALUES ($1,$2,$3)', [userId, def.id, now])
    return { ok: true, coins: await balance(t, `u:${userId}`) } as const
  })
}

export type SelectAvatarResult = { ok: true } | { ok: false; code: 'invalid' | 'not_owned' }

export async function selectAvatar(db: Db, userId: string, id: unknown): Promise<SelectAvatarResult> {
  const def = avatarOf(id)
  if (!def) return { ok: false, code: 'invalid' }
  if (def.price > 0) {
    const has = await db.query('SELECT 1 FROM avatars_owned WHERE user_id = $1 AND avatar = $2', [userId, def.id])
    if (!has.rows.length) return { ok: false, code: 'not_owned' }
  }
  await db.query('UPDATE users SET avatar = $2 WHERE id = $1', [userId, def.id])
  return { ok: true }
}
