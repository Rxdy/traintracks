// Synthèse des sons du jeu (Web Audio) : aucun fichier audio, tout est calculé. Ce fichier ne décide pas QUAND
// jouer (c'est director.ts) ; il sait seulement fabriquer chaque son retenu et le jouer sur un « bus » de volume.
// Sans Web Audio (tests, vieux navigateur), tout est sans effet.
type Ctor = typeof AudioContext
const Ctx: Ctor | undefined = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext)

export type BusName = 'sfx' | 'train' | 'amb'
export const BUS_LEVEL: Record<BusName, number> = { sfx: 1, train: 0.3, amb: 0.5 }
const MASTER_LEVEL = 0.55

let ctx: AudioContext | null = null
let master: GainNode
let noise: AudioBuffer
const buses = {} as Record<BusName, GainNode>

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
      buses[k].connect(master)
    }
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
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
