// Synthèse des sons du jeu (Web Audio) : aucun fichier audio, tout est calculé. Ce fichier ne décide pas QUAND
// jouer (c'est director.ts) ; il sait seulement fabriquer chaque son retenu et le jouer sur un « bus » de volume.
// Sans Web Audio (tests, vieux navigateur), tout est sans effet.
type Ctor = typeof AudioContext
const Ctx: Ctor | undefined = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext)

export type BusName = 'sfx' | 'train' | 'amb' | 'music' | 'lobby'
// music : la musique des menus (lobby) ; lobby : le train qui passe derrière, sur l'accueil
export const BUS_LEVEL: Record<BusName, number> = { sfx: 1, train: 0.3, amb: 0.5, music: 0.55, lobby: 0.5 }
const MASTER_LEVEL = 0.55

let ctx: AudioContext | null = null
let master: GainNode
let noise: AudioBuffer
let reverb: ConvolverNode
const buses = {} as Record<BusName, GainNode>
// le volume choisi par le joueur (Paramètres), par famille de sons : un étage à part, que les fondus du jeu ne touchent pas
const userGains = {} as Record<BusName, GainNode>
const userLevel: Record<BusName, number> = { sfx: 1, train: 1, amb: 1, music: 1, lobby: 1 }
/** Volume du joueur pour une famille de sons (0 à 1). */
export function setUserLevel(name: BusName, v: number): void {
  userLevel[name] = Math.max(0, Math.min(1, v))
  if (ctx && userGains[name]) userGains[name].gain.setTargetAtTime(userLevel[name], ctx.currentTime, 0.05)
}

export const available = () => !!Ctx

function ensure(): AudioContext | null {
  if (!Ctx) return null
  if (!ctx) {
    ctx = new Ctx()
    master = ctx.createGain()
    master.gain.value = MASTER_LEVEL
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ctx.destination)
    for (const k of Object.keys(BUS_LEVEL) as BusName[]) {
      buses[k] = ctx.createGain()
      buses[k].gain.value = BUS_LEVEL[k]
      userGains[k] = ctx.createGain()
      userGains[k].gain.value = userLevel[k]
      buses[k].connect(userGains[k])
      userGains[k].connect(master)
    }
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    // réverbération (salle calculée : du bruit qui s'éteint), pour la musique et le train de l'accueil
    reverb = ctx.createConvolver()
    const n = Math.floor(ctx.sampleRate * 3), ir = ctx.createBuffer(2, n, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.4) }
    reverb.buffer = ir
    const wet = ctx.createGain(); wet.gain.value = 0.45
    reverb.connect(wet); wet.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}
export function unlock(): void {
  ensure()
}
export function suspend(on: boolean): void {
  if (!ctx) return
  if (on) void ctx.suspend()
  else void ctx.resume()
}
// Baisse un bus un instant (le décor s'efface sous un son important) ou le règle.
export function setBus(name: BusName, level: number, seconds = 0.15): void {
  if (!ctx) return
  buses[name].gain.cancelScheduledValues(ctx.currentTime)
  buses[name].gain.setTargetAtTime(level, ctx.currentTime, seconds / 3)
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const rnd = (a: number, b: number) => a + Math.random() * (b - a)

interface ToneOpts { f: number; f2?: number; t?: number; d?: number; a?: number; v?: number; type?: OscillatorType; hold?: number; vib?: [number, number]; lp?: number; out: AudioNode }
function tone(o: ToneOpts): void {
  const c = ctx!
  const t0 = c.currentTime + (o.t ?? 0), d = o.d ?? 0.2, a = o.a ?? 0.005, v = o.v ?? 0.2
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, t0)
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(v, t0 + a)
  if (o.hold) g.gain.setValueAtTime(v, t0 + d * o.hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
  let node: AudioNode = osc
  if (o.vib) {
    const l = c.createOscillator(), lg = c.createGain()
    l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]
    l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + d + 0.05)
  }
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f }
  node.connect(g); g.connect(o.out)
  osc.start(t0); osc.stop(t0 + d + 0.05)
}
interface NoiseOpts { t?: number; d?: number; a?: number; v?: number; type?: BiquadFilterType; f?: number; f2?: number; q?: number; hold?: number; out: AudioNode }
function nz(o: NoiseOpts): void {
  const c = ctx!
  const t0 = c.currentTime + (o.t ?? 0), d = o.d ?? 0.1, a = o.a ?? 0.003, v = o.v ?? 0.2
  const src = c.createBufferSource(); src.buffer = noise; src.loop = true
  const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'
  f.frequency.setValueAtTime(o.f ?? 1000, t0)
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + d)
  f.Q.value = o.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(v, t0 + a)
  if (o.hold) g.gain.setValueAtTime(v, t0 + d * o.hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d)
  src.connect(f); f.connect(g); g.connect(o.out)
  src.start(t0, Math.random()); src.stop(t0 + d + 0.05)
}
// fond continu ; renvoie sa fonction d'arrêt (fondu de 0,4 s)
function bed(out: AudioNode, o: { type?: BiquadFilterType; f: number; q?: number; v: number; lfo?: [number, number][]; fade?: number }): () => void {
  const c = ctx!
  const src = c.createBufferSource(); src.buffer = noise; src.loop = true
  const f = c.createBiquadFilter(); f.type = o.type ?? 'bandpass'; f.frequency.value = o.f; f.Q.value = o.q ?? 1
  const g = c.createGain(); g.gain.value = 0.0001
  g.gain.linearRampToValueAtTime(o.v, c.currentTime + (o.fade ?? 2.5))
  src.connect(f); f.connect(g); g.connect(out)
  const lfos = (o.lfo ?? []).map(([hz, depth]) => { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = hz; lg.gain.value = depth; l.connect(lg); lg.connect(f.frequency); l.start(); return l })
  src.start(0, Math.random())
  return () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.4); src.stop(c.currentTime + 0.45); lfos.forEach((l) => l.stop(c.currentTime + 0.45)) } catch { /* déjà arrêté */ } }
}
// répète fn(décalage, i) toutes les `period` secondes, planifié un peu à l'avance ; renvoie l'arrêt
function looper(period: number | ((i: number) => number), fn: (dt: number, i: number) => void): () => void {
  const c = ctx!
  let next = c.currentTime + 0.05, i = 0
  const id = window.setInterval(() => {
    while (next < c.currentTime + 0.35) { fn(Math.max(0, next - c.currentTime), i); i++; next += typeof period === 'function' ? period(i) : period }
  }, 60)
  return () => clearInterval(id)
}

// ---- instruments : ceux qu'on a retenus ----
const jouet = (f: number, t: number, v: number, out: AudioNode) => { tone({ f, t, d: 0.3, type: 'triangle', v: v * 0.55, out }); tone({ f: f * 2, t, d: 0.09, type: 'square', v: v * 0.05, out }) }
const cristal = (f: number, t: number, d: number, v: number, out: AudioNode) => [[1, 1], [2.76, 0.35], [5.4, 0.14]].forEach(([m, k]) => tone({ f: f * m, t, d: d + 0.9, v: v * 0.3 * k, a: 0.003, out }))
const phrase = (notes: [number, number, number][], out: AudioNode) => notes.forEach(([s, t, v]) => jouet(mtof(72 + s), t, v, out))

// ---- sons ponctuels ----
export type SfxName = 'pose' | 'clear' | 'error' | 'reveal' | 'coin' | 'barrier' | 'boat' | 'duck' | 'bird' | 'owl' | 'squirrel' | 'car'
const SFX: Record<SfxName, { bus: BusName; play: (out: AudioNode, k: number) => void }> = {
  // emboîtement : un petit clic sec, puis un « toc » grave et mat. k : hauteur (monte un peu le long d'un glissé)
  pose: { bus: 'sfx', play: (o, k) => { nz({ d: 0.022, f: 2200 * k, q: 3, v: 0.3, out: o }); tone({ t: 0.014, f: 190 * k, f2: 115 * k, d: 0.1, v: 0.4, out: o }) } },
  clear: { bus: 'sfx', play: (o) => phrase([[7, 0, 0.5], [4, 0.08, 0.5], [0, 0.16, 0.5], [-5, 0.24, 0.5]], o) },
  error: { bus: 'sfx', play: (o) => phrase([[-3, 0, 0.7], [-8, 0.14, 0.7]], o) },
  reveal: { bus: 'sfx', play: (o) => phrase([[0, 0, 0.3], [7, 0.15, 0.3], [12, 0.3, 0.35], [16, 0.45, 0.35], [19, 0.6, 0.4], [24, 0.75, 0.4]], o) },
  coin: { bus: 'sfx', play: (o) => { cristal(mtof(91), 0, 0.08, 0.6, o); cristal(mtof(96), 0.07, 0.35, 0.7, o) } },
  barrier: { bus: 'sfx', play: (o) => { for (let i = 0; i < 14; i++) tone({ t: i * 0.1, f: 1500, d: 0.02, type: 'square', v: 0.05, out: o }) } },
  boat: { bus: 'amb', play: (o) => { tone({ f: 110, d: 1.3, type: 'sawtooth', v: 0.14, hold: 0.7, lp: 600, a: 0.08, out: o }); tone({ f: 165, d: 1.3, type: 'sawtooth', v: 0.1, hold: 0.7, lp: 600, a: 0.08, out: o }) } },
  duck: { bus: 'amb', play: (o) => [0, 0.18].forEach((t) => tone({ t, f: 420, f2: 250, d: 0.13, type: 'sawtooth', v: 0.12, lp: 1400, out: o })) },
  bird: { bus: 'amb', play: (o) => { for (let i = 0; i < 6; i++) { const f = rnd(2800, 3800); tone({ t: i * 0.13, f, f2: f * 1.35, d: 0.07, v: 0.1, out: o }) } } },
  owl: { bus: 'amb', play: (o) => [0, 0.55].forEach((t, i) => { tone({ t, f: 330, f2: i ? 280 : 310, d: 0.45, v: 0.25, hold: 0.5, a: 0.06, out: o }); nz({ t, d: 0.4, type: 'lowpass', f: 700, v: 0.05, out: o }) }) },
  squirrel: { bus: 'amb', play: (o) => { for (let i = 0; i < 9; i++) nz({ t: i * 0.055, d: 0.018, f: 3500, q: 6, v: 0.28 * (1 - i * 0.07), out: o }) } },
  // moteur : surtout un ronronnement qui monte puis descend (un souffle seul se confondrait avec du vent)
  car: { bus: 'amb', play: (o) => { tone({ f: 85, f2: 150, d: 1.3, type: 'sawtooth', v: 0.11, hold: 0.5, a: 0.3, lp: 520, out: o }); tone({ f: 170, f2: 300, d: 1.3, type: 'square', v: 0.025, hold: 0.5, a: 0.3, lp: 700, out: o }); nz({ d: 1.3, type: 'lowpass', f: 300, f2: 600, v: 0.05, hold: 0.5, a: 0.3, out: o }) } },
}
export function play(name: SfxName, k = 1): void {
  if (!ensure()) return
  SFX[name].play(buses[SFX[name].bus], k)
}

// ---- sons continus : le train, la cloche, et le fond du décor ----
export type LoopName = 'think' | 'clack' | 'chug' | 'bell' | 'water' | 'wind' | 'windmill'
const LOOPS: Record<LoopName, { bus: BusName; start: (out: AudioNode) => () => void }> = {
  // réflexion : UNE note longue et chaude (pas de mélodie), qui monte doucement, reste, puis s'éteint (9 s)
  think: { bus: 'sfx', start: (o) => {
    const c = ctx!
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, c.currentTime)
    g.gain.linearRampToValueAtTime(1, c.currentTime + 2.5)
    g.gain.setValueAtTime(1, c.currentTime + 5.5)
    g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 9)
    g.connect(o)
    tone({ f: 196, d: 9.2, v: 0.08, a: 0.01, hold: 0.99, vib: [0.35, 0.8], out: g })
    tone({ f: 294, d: 9.2, v: 0.035, a: 0.01, hold: 0.99, vib: [0.3, 1.2], out: g })
    tone({ f: 392, d: 9.2, type: 'triangle', v: 0.012, a: 0.01, hold: 0.99, out: g })
    return () => { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.5) } catch { /* déjà éteint */ } }
  } },
  clack: { bus: 'train', start: (o) => looper(0.25, (dt, i) => tone({ t: dt, f: i % 2 ? 440 : 520, d: 0.06, v: 0.22, out: o })) },
  chug: { bus: 'train', start: (o) => looper(0.26, (dt, i) => { nz({ t: dt, d: 0.2, f: 1100, q: 0.6, v: i % 4 === 0 ? 0.5 : 0.32, a: 0.02, out: o }); tone({ t: dt, f: 75, f2: 55, d: 0.14, v: i % 4 === 0 ? 0.5 : 0.3, out: o }) }) },
  bell: { bus: 'sfx', start: (o) => looper(0.46, (dt, i) => { const f = i % 2 ? 1000 : 1180; [[1, 1], [2.76, 0.4], [5.4, 0.15]].forEach(([m, k]) => tone({ t: dt, f: f * m, d: 0.9, v: 0.15 * k, a: 0.002, out: o })) }) },
  // courant lent + de petites bulles : sans elles, ce souffle grave se prend pour du vent
  water: { bus: 'amb', start: (o) => { const b = bed(o, { type: 'lowpass', f: 650, q: 0.5, v: 0.2, lfo: [[0.2, 140]] }); const s = looper(() => 0.35 + Math.random() * 0.9, (dt) => tone({ t: dt, f: rnd(380, 600), f2: rnd(800, 1300), d: 0.07, v: 0.07, out: o })); return () => { b(); s() } } },
  wind: { bus: 'amb', start: (o) => bed(o, { f: 950, q: 9, v: 0.18, lfo: [[0.18, 260], [0.09, 120]] }) },
  windmill: { bus: 'amb', start: (o) => looper(0.5, (dt) => nz({ t: dt, d: 0.4, type: 'lowpass', f: 700, f2: 200, v: 0.2, a: 0.08, out: o })) },
}
export function startLoop(name: LoopName): () => void {
  if (!ensure()) return () => {}
  return LOOPS[name].start(buses[LOOPS[name].bus])
}

// ---- musique des menus : « Quai du matin » (lo-fi, 74 bpm) et le train à vapeur qui passe derrière ----
// Choisis sur le banc d'écoute : piano électrique doux, basse ronde, balais, léger craquement de disque ; le train passe en 9 s,
// d'une enceinte à l'autre, plus fort et plus clair devant, avec l'effet Doppler sur le sifflet.
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function envAt(g: GainNode, t: number, a: number, peak: number, d: number): void {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
}
function wetSend(node: AudioNode, out: AudioNode, wet: number): void {
  node.connect(out)
  if (wet > 0) { const s = ctx!.createGain(); s.gain.value = wet; node.connect(s); s.connect(reverb) }
}
function epiano(t: number, m: number, dur: number, v: number, out: AudioNode): void {
  const c = ctx!, f = mtof(m), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain()
  car.frequency.value = f; mod.frequency.value = f
  mg.gain.setValueAtTime(f * 1.4, t); mg.gain.exponentialRampToValueAtTime(f * 0.04, t + 0.7)
  mod.connect(mg); mg.connect(car.frequency); car.connect(g)
  envAt(g, t, 0.006, v, dur)
  wetSend(g, out, 0.25)
  car.start(t); mod.start(t); car.stop(t + dur + 0.2); mod.stop(t + dur + 0.2)
}
function bassAt(t: number, m: number, dur: number, v: number, out: AudioNode): void {
  const c = ctx!, a = c.createOscillator(), b = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(), k = c.createGain()
  a.frequency.value = b.frequency.value = mtof(m); b.type = 'triangle'; k.gain.value = 0.3
  lp.type = 'lowpass'; lp.frequency.value = 480
  a.connect(lp); b.connect(k); k.connect(lp); lp.connect(g); envAt(g, t, 0.012, v, dur); g.connect(out)
  for (const x of [a, b]) { x.start(t); x.stop(t + dur + 0.1) }
}
function hitAt(t: number, d: number, o: { type?: BiquadFilterType; f: number; f2?: number; q?: number; v: number; a?: number }, out: AudioNode, wet = 0): void {
  const c = ctx!, s = c.createBufferSource(); s.buffer = noise
  const bq = c.createBiquadFilter(); bq.type = o.type ?? 'bandpass'; bq.frequency.setValueAtTime(o.f, t)
  if (o.f2) bq.frequency.exponentialRampToValueAtTime(o.f2, t + d)
  bq.Q.value = o.q ?? 1
  const g = c.createGain(); envAt(g, t, o.a ?? 0.005, o.v, d)
  s.connect(bq); bq.connect(g); wetSend(g, out, wet)
  s.start(t, Math.random() * 1.5, d + (o.a ?? 0.005) + 0.05)
}
function kickAt(t: number, v: number, out: AudioNode): void {
  const c = ctx!, os = c.createOscillator(), g = c.createGain()
  os.frequency.setValueAtTime(115, t); os.frequency.exponentialRampToValueAtTime(42, t + 0.18)
  envAt(g, t, 0.004, v, 0.28); os.connect(g); g.connect(out); os.start(t); os.stop(t + 0.4)
}
const QUAI = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] // Fa maj7, Mi m7, Ré m7, Do maj7
function quaiStep(i: number, t: number, sd: number, out: AudioNode): void {
  const bar = Math.floor(i / 8), s = i % 8, ch = QUAI[bar % 4]
  t += s % 2 ? sd * 0.18 : 0 // swing
  if (s === 0) ch.forEach((m, k) => epiano(t + k * 0.014, m + 12, sd * 7, 0.065, out))
  if (s === 5) ch.slice(1).forEach((m, k) => epiano(t + k * 0.01, m + 12, sd * 2.5, 0.035, out))
  if (s === 0) bassAt(t, ch[0] - 12, sd * 3, 0.22, out)
  if (s === 3) bassAt(t, ch[0] - 5, sd * 1.4, 0.14, out)
  if (s === 6) bassAt(t, ch[0] - 12, sd * 1.4, 0.15, out)
  if (s === 0 || (s === 5 && bar % 2)) kickAt(t, 0.22, out)
  if (s === 4) hitAt(t, 0.14, { f: 1800, q: 0.7, v: 0.05 }, out, 0.2) // caisse claire aux balais
  if (s % 2) hitAt(t, 0.05, { type: 'highpass', f: 7000, v: s === 3 || s === 7 ? 0.045 : 0.028 }, out)
  const r = seeded(bar * 31 + s * 7 + 1)
  if (bar % 8 >= 2 && r() < 0.28) { const pool = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[3] + 12]; epiano(t, pool[Math.floor(r() * 4)], sd * 3, 0.045, out) }
  if (r() < 0.55) hitAt(t + r() * sd, 0.004, { type: 'highpass', f: 2500, v: 0.035 }, out) // craquement du disque
}
// Lance la musique des menus (fondu d'entrée) ; renvoie son arrêt (fondu de sortie).
export function startMusic(): () => void {
  const c = ensure()
  if (!c) return () => {}
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(1, c.currentTime + 2)
  g.connect(buses.music)
  const sd = 60 / 74 / 2 // une croche à 74 bpm
  const stop = looper(sd, (dt, i) => quaiStep(i, c.currentTime + dt, sd, g))
  return () => {
    stop()
    const t = c.currentTime
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.8)
    window.setTimeout(() => g.disconnect(), 6000)
  }
}
// Le train à vapeur passe derrière, sur l'accueil : `dir` 1 de gauche à droite, -1 dans l'autre sens ; `dur` en secondes.
export function lobbyTrain(dir: 1 | -1, dur = 9): void {
  const c = ensure()
  if (!c) return
  const t0 = c.currentTime + 0.03, N = 96
  const gain = new Float32Array(N), cut = new Float32Array(N), pan = new Float32Array(N), det = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1), d = (x - 0.5) * 2, near = Math.exp(-Math.pow(d * 1.7, 2))
    gain[i] = Math.max(0.0001, Math.min(1, x / 0.1, (1 - x) / 0.1) * (0.1 + 0.9 * near))
    cut[i] = 450 + 5000 * near
    pan[i] = dir * d * 0.9
    det[i] = 45 * Math.tanh(-d * 3) // plus aigu en approchant, plus grave en s'éloignant
  }
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueCurveAtTime(cut, t0, dur)
  const g = c.createGain(); g.gain.setValueCurveAtTime(gain, t0, dur)
  const p = c.createStereoPanner(); p.pan.setValueCurveAtTime(pan, t0, dur)
  lp.connect(g); g.connect(p); p.connect(buses.lobby)
  const w = c.createGain(); w.gain.value = 0.25; g.connect(w); w.connect(reverb)
  // halètement de la cheminée, un temps fort sur quatre
  let k = 0
  for (let t = t0; t < t0 + dur; t += 0.27, k++) hitAt(t, 0.2, { f: k % 4 === 0 ? 700 : 950, q: 0.7, v: k % 4 === 0 ? 0.55 : 0.35, a: 0.015 }, lp)
  // grondement sourd
  const rs = c.createBufferSource(); rs.buffer = noise; rs.loop = true
  const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 140
  const rg = c.createGain(); rg.gain.value = 0.22
  rs.connect(rl); rl.connect(rg); rg.connect(lp); rs.start(t0); rs.stop(t0 + dur)
  // sifflet en accord, qui suit l'effet Doppler
  const ws = t0 + dur * 0.3, wl = 1.5
  const wg = c.createGain(), wf = c.createBiquadFilter()
  wf.type = 'lowpass'; wf.frequency.value = 3000
  wg.gain.setValueAtTime(0.0001, ws); wg.gain.linearRampToValueAtTime(0.09, ws + 0.08); wg.gain.setValueAtTime(0.09, ws + wl - 0.3); wg.gain.linearRampToValueAtTime(0.0001, ws + wl)
  wf.connect(wg); wg.connect(lp)
  for (const f of [622, 740, 932]) {
    const os = c.createOscillator(); os.frequency.value = f
    os.detune.setValueCurveAtTime(det, t0, dur)
    const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = 6; l.connect(lg); lg.connect(os.detune); l.start(ws); l.stop(ws + wl)
    os.connect(wf); os.start(ws); os.stop(ws + wl + 0.05)
  }
  hitAt(ws, 1.4, { f: 1500, q: 1.5, v: 0.05, a: 0.08 }, lp) // le souffle du sifflet
  window.setTimeout(() => { lp.disconnect(); g.disconnect(); p.disconnect(); w.disconnect() }, (dur + 3) * 1000)
}
