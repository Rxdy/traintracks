// Environnements du décor : un par « chapitre » du Voyage, avec leurs réglages (quoi placer, en quelle quantité)
// et leur palette (couleurs de chaque élément ET de la voie : pas de rails enneigés sur un sol de prairie).
// Un environnement par « chapitre » du Voyage : le décor reste cohérent d'un niveau à l'autre, puis change.
// Durée pendant laquelle le décor se dévoile avant que le train ne démarre (0 : tout de suite, pour les tests).
export const timing = { revealMs: 2800 }

export type Theme =
  | 'plaine' | 'foret' | 'automne' | 'montagne' | 'hiver'
  | 'ville' | 'desert' | 'tropical' | 'canyon' | 'volcan' | 'enfer' | 'bonbons' | 'lune' | 'neon' | 'fusion'
// Premier tour : du plus calme au plus loufoque. Les tours suivants mélangent l'ordre (voir orderFor).
export const THEMES: Theme[] = ['plaine', 'foret', 'automne', 'montagne', 'hiver', 'ville', 'desert', 'tropical', 'canyon', 'volcan', 'enfer', 'bonbons', 'lune', 'neon', 'fusion']
export const THEME_NAMES: Record<Theme, string> = {
  plaine: 'Plaine', foret: 'Forêt', automne: 'Automne', montagne: 'Montagne', hiver: 'Hiver',
  ville: 'Ville', desert: 'Désert', tropical: 'Île tropicale', canyon: 'Grand Canyon', volcan: 'Volcan', enfer: 'Enfer', bonbons: 'Pays des bonbons', lune: 'Lune', neon: 'Ville néon', fusion: 'Fusion feu et glace',
}
export const LEVELS_PER_THEME = 25

// Ordre des environnements pour chaque « tour ». Tour 0 : l'ordre ci-dessus. Tours suivants : mélange fixé par le
// numéro du tour (donc toujours le même pour tout le monde), sans jamais répéter l'environnement qui vient de finir.
const orders: Theme[][] = [THEMES]
function orderFor(pass: number): Theme[] {
  while (orders.length <= pass) {
    const p = orders.length
    let a = (p * 7919 + 104729) | 0
    const rand = () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const o = [...THEMES]
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[o[i], o[j]] = [o[j], o[i]]
    }
    const prev = orders[p - 1]
    if (o[0] === prev[prev.length - 1]) [o[0], o[1]] = [o[1], o[0]]
    orders.push(o)
  }
  return orders[pass]
}
export function themeForLevel(level: number): Theme {
  const chapter = Math.floor((Math.max(1, level) - 1) / LEVELS_PER_THEME)
  return orderFor(Math.floor(chapter / THEMES.length))[chapter % THEMES.length]
}

export interface Params {
  river: number // probabilité d'une rivière
  tree: number // part des cases libres plantées d'arbres
  pine: number // parmi les arbres, part de sapins
  houseBase: number
  houseRatio: number
  fields: number // nombre de champs
  peaks: number // part des cases libres (loin de la voie) transformées en montagnes
  boulders: number
  snowmen: number
  road: number // probabilité d'une route (avec passage à niveau quand elle croise la voie)
  windmills: number
  houseKind?: 'house' | 'building' // ce que « maison » devient : immeuble en ville
  peakKind?: 'mountain' | 'mesa' | 'dune' // ce que « montagne » devient : mesa au canyon, dune au désert
  clump?: boolean // arbres et reliefs en GROUPES (bosquets, crêtes) plutôt qu'au hasard
  treeKind?: 'tree' | 'cactus' | 'palm' | 'crater' | 'deadtree' // ce que « arbre » devient dans cet environnement
  pineKind?: 'pine' | 'cactus' | 'palm' | 'vent' | 'skull' | 'boulder'
}
export const PARAMS: Record<Theme, Params> = {
  plaine: { clump: true, river: 1, tree: 0.4, pine: 0.1, houseBase: 1, houseRatio: 0.12, fields: 2, peaks: 0, boulders: 0, snowmen: 0, road: 0.85, windmills: 1 },
  foret: { clump: true, river: 0.5, tree: 0.6, pine: 0.6, houseBase: 0, houseRatio: 0, fields: 0, peaks: 0, boulders: 0.05, snowmen: 0, road: 0.35, windmills: 0 },
  automne: { clump: true, river: 1, tree: 0.5, pine: 0.12, houseBase: 1, houseRatio: 0.12, fields: 2, peaks: 0, boulders: 0, snowmen: 0, road: 0.8, windmills: 0 },
  montagne: { clump: true, river: 0.7, tree: 0.25, pine: 0.7, houseBase: 1, houseRatio: 0.05, fields: 0, peaks: 0.3, boulders: 0.2, snowmen: 0, road: 0.5, windmills: 0 },
  hiver: { clump: true, river: 0.8, tree: 0.35, pine: 0.7, houseBase: 1, houseRatio: 0.1, fields: 0, peaks: 0.08, boulders: 0, snowmen: 0.2, road: 0.6, windmills: 0 },
  ville: { river: 0.7, tree: 0.25, pine: 0.1, houseBase: 3, houseRatio: 0.38, fields: 0, peaks: 0, boulders: 0, snowmen: 0, road: 1, windmills: 0, houseKind: 'building' },
  desert: { clump: true, peakKind: 'dune', river: 0.4, tree: 0.3, pine: 0.5, houseBase: 1, houseRatio: 0.08, fields: 0, peaks: 0.3, boulders: 0.25, snowmen: 0, road: 0.7, windmills: 0, treeKind: 'cactus', pineKind: 'cactus' },
  tropical: { clump: true, river: 1, tree: 0.75, pine: 0.7, houseBase: 1, houseRatio: 0.06, fields: 0, peaks: 0, boulders: 0.1, snowmen: 0, road: 0.35, windmills: 0, pineKind: 'palm', treeKind: 'palm' },
  canyon: { clump: true, peakKind: 'mesa', river: 0.8, tree: 0.2, pine: 0.4, houseBase: 1, houseRatio: 0.05, fields: 0, peaks: 0.36, boulders: 0.3, snowmen: 0, road: 0.7, windmills: 0, treeKind: 'cactus', pineKind: 'cactus' },
  volcan: { clump: true, river: 0.9, tree: 0.2, pine: 0.5, houseBase: 1, houseRatio: 0.04, fields: 0, peaks: 0.45, boulders: 0.3, snowmen: 0, road: 0.4, windmills: 0, pineKind: 'vent' },
  enfer: { clump: true, river: 1, tree: 0.4, pine: 0.6, houseBase: 1, houseRatio: 0.06, fields: 0, peaks: 0, boulders: 0.15, snowmen: 0, road: 0.3, windmills: 0, treeKind: 'deadtree', pineKind: 'skull' },
  bonbons: { clump: true, river: 1, tree: 0.6, pine: 0.5, houseBase: 2, houseRatio: 0.1, fields: 2, peaks: 0, boulders: 0.1, snowmen: 0, road: 0.8, windmills: 0 },
  lune: { clump: true, river: 0.25, tree: 0.5, pine: 0.4, houseBase: 1, houseRatio: 0.05, fields: 0, peaks: 0.15, boulders: 0.2, snowmen: 0, road: 0.5, windmills: 0, treeKind: 'crater', pineKind: 'boulder' },
  neon: { clump: true, river: 1, tree: 0.55, pine: 0.5, houseBase: 2, houseRatio: 0.1, fields: 0, peaks: 0.1, boulders: 0.1, snowmen: 0, road: 0.9, windmills: 0 },
  fusion: { clump: true, river: 0.8, tree: 0.4, pine: 0.6, houseBase: 1, houseRatio: 0.05, fields: 0, peaks: 0.2, boulders: 0.1, snowmen: 0.15, road: 0.5, windmills: 0 },
}
export interface Pal {
  a: string // herbe / sol
  b: string // damier léger
  bed: string // lit de la voie
  bedEdge: string
  bank: string // berge
  water: string
  shine: string
  deep: string // fond de la rivière : plus sombre que l'eau, jamais couleur sable (sinon on dirait une route)
  shallow: string // bord peu profond
  road: string // asphalte
  canopy: [string, string, string] // arbres feuillus
  fruit: string | null
  pine: [string, string] // sapins
  snow: boolean // neige sur sapins, toits et montagnes
  crops: [string, string][]
  walls: string[]
  roofs: string[]
  dots: [string, string, string] // fleurs, feuilles mortes, cailloux, bosses de neige
  tuft: string
  rock: [string, string] // rochers
  rail: { rail: string; tie: string } // la voie elle-même : acier et traverses selon le sol
  cap?: string // sommet des montagnes (neige par défaut ; lave au volcan)
  trunk?: string // tronc des arbres
  life?: boolean // false : le liquide n'est pas de l'eau (lave, chocolat, néon…) : ni bateaux, ni poissons, ni canards
}
export const PAL: Record<Theme, Pal> = {
  plaine: {
    a: '#9bd66f', b: '#8acb5f', bed: '#e6d9ab', bedEdge: '#c9b784', bank: '#e2d6a4', water: '#4aa8e8', shine: '#8fcdf5', deep: '#2f86c8', shallow: '#7cc4f0', road: '#6b7480',
    canopy: ['#3f9d4a', '#4cae56', '#45a550'], fruit: '#ef4444', pine: ['#2f7d4a', '#3a9158'], snow: false,
    crops: [['#e9c75b', '#dcb549'], ['#7cc653', '#6bb745'], ['#b98a5a', '#a67a4c']],
    walls: ['#fdf3dc', '#fbd9d0', '#f9e5a6', '#ffffff'], roofs: ['#c2410c', '#9a3412', '#1d4ed8', '#b45309'],
    dots: ['#ffffff', '#fde68a', '#ffffff'], tuft: '#5fae45', rock: ['#9ca3af', '#6b7280'],
    rail: { rail: '#475569', tie: '#7a4e2d' },
  },
  foret: {
    a: '#68b563', b: '#5ba857', bed: '#d9c9a0', bedEdge: '#b8a57a', bank: '#cdbf94', water: '#3f9fd6', shine: '#85c8ee', deep: '#2a7fb0', shallow: '#6fbbe3', road: '#6b7480',
    canopy: ['#2f8a42', '#3a9a4c', '#2a7d3d'], fruit: null, pine: ['#25663d', '#2f7d4a'], snow: false,
    crops: [['#e9c75b', '#dcb549']],
    walls: ['#c79a63', '#b98a55', '#d2a770', '#a97c4d'], roofs: ['#5b3a21', '#4a2f1b', '#2f5d3a', '#6b4226'],
    dots: ['#fca5a5', '#fde68a', '#ffffff'], tuft: '#3f8f3f', rock: ['#9ca3af', '#6b7280'],
    rail: { rail: '#3f4a57', tie: '#5b3a21' },
  },
  automne: {
    a: '#d2c872', b: '#c7bd63', bed: '#e3cf9c', bedEdge: '#bfa56d', bank: '#d9c58b', water: '#5aa5c9', shine: '#9ccbe2', deep: '#3f86a8', shallow: '#86c0dc', road: '#76706a',
    canopy: ['#e0792b', '#f0a03a', '#c4541f'], fruit: '#7c2d12', pine: ['#3d6b3a', '#4a7d44'], snow: false,
    crops: [['#e5b94a', '#d5a53a'], ['#c9833a', '#b9722d'], ['#a8794e', '#966a42']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#9a3412', '#7c2d12', '#b45309', '#78350f'],
    dots: ['#e0792b', '#b4361b', '#f0a03a'], tuft: '#a8892f', rock: ['#a39a8c', '#7a7165'],
    rail: { rail: '#57534e', tie: '#7c4a21' },
  },
  montagne: {
    a: '#a9c49a', b: '#9dba8e', bed: '#d3cab8', bedEdge: '#b3a892', bank: '#dfe6e8', water: '#55bfd6', shine: '#a6e2ee', deep: '#359db8', shallow: '#86d6e6', road: '#6f7782',
    canopy: ['#4a8a55', '#559860', '#3f7d4b'], fruit: null, pine: ['#2d6a4a', '#37805a'], snow: false,
    crops: [['#cdbf6a', '#bdaf5c']],
    walls: ['#c79a63', '#d9b98a', '#b98a55', '#e8d4b0'], roofs: ['#6b3a22', '#7c2d12', '#374151', '#9a3412'],
    dots: ['#d1d5db', '#e5e7eb', '#9ca3af'], tuft: '#7e9c70', rock: ['#9aa3ad', '#6b7280'],
    rail: { rail: '#52525b', tie: '#8b8b94' },
  },
  hiver: {
    a: '#f2f6fb', b: '#e5edf6', bed: '#cdd7e3', bedEdge: '#aebbcb', bank: '#ffffff', water: '#bfe4f5', shine: '#ffffff', deep: '#8cc4de', shallow: '#d7eff9', road: '#9aa6b4',
    canopy: ['#dce7f1', '#edf3f9', '#cbd9e8'], fruit: null, pine: ['#2f6b57', '#3b806a'], snow: true,
    crops: [['#e5edf6', '#d6e1ee']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#f8fbff', '#eef4fa', '#f8fbff', '#e6eef7'],
    dots: ['#dbe7f3', '#cbd9e8', '#ffffff'], tuft: '#b4c4d6', rock: ['#b5bfcb', '#8a96a5'],
    rail: { rail: '#64748b', tie: '#dfe8f2' },
  },
  desert: {
    a: '#e9cf8e', b: '#e0c17c', bed: '#c9a86a', bedEdge: '#a9864a', bank: '#c9a86a', water: '#3cc7c0', shine: '#aef0ea', deep: '#1f8f93', shallow: '#6fdcd6', road: '#8a7358',
    canopy: ['#4f9a5b', '#5fae6b', '#418a50'], fruit: '#f472b6', pine: ['#4a8f54', '#5aa564'], snow: false,
    crops: [['#d9b866', '#c9a655']],
    walls: ['#f1dcb4', '#e8c99a', '#f7e7c8', '#dcb98a'], roofs: ['#c08457', '#a86a40', '#d9a066', '#8a5a3a'],
    dots: ['#f8e9c0', '#d1a85a', '#fff3d0'], tuft: '#b49a52', rock: ['#c9a06a', '#9c7440'],
    rail: { rail: '#5b4636', tie: '#7a4e2d' },
    cap: '#f5deb3',
  },
  tropical: {
    a: '#f1e0a2', b: '#e9d595', bed: '#d9c58a', bedEdge: '#b8a468', bank: '#d9c58a', water: '#2ed0d6', shine: '#b5f5f7', deep: '#1595a3', shallow: '#6fe3e6', road: '#8a7a58',
    canopy: ['#1f9a46', '#2fb057', '#178a3b'], fruit: '#f59e0b', pine: ['#2fa84f', '#43c065'], snow: false,
    crops: [['#e9c75b', '#dcb549']],
    walls: ['#d9b97a', '#c9a665', '#e6cc90', '#bf9a58'], roofs: ['#b58a3a', '#a07a30', '#c99a48', '#8f6a28'],
    dots: ['#fb7185', '#fde047', '#f472b6'], tuft: '#2b8a3a', rock: ['#c9b98a', '#9c8e62'],
    rail: { rail: '#4a4a3f', tie: '#6b4a2a' },
    trunk: '#8a5a2e',
  },
  canyon: {
    a: '#d98a4e', b: '#cf7d42', bed: '#e3b98a', bedEdge: '#b8865a', bank: '#e3b98a', water: '#c98a58', shine: '#f0c9a0', deep: '#8a4b2a', shallow: '#dba878', road: '#6b4a38',
    canopy: ['#5f9a5b', '#6fae6b', '#4f8a4b'], fruit: '#f97316', pine: ['#5a8f54', '#6aa564'], snow: false,
    crops: [['#caa05a', '#b98f4a']],
    walls: ['#e8c9a0', '#dba878', '#f1dcb8', '#c99a68'], roofs: ['#9a3412', '#7c2d12', '#b45309', '#6b2a12'],
    dots: ['#f1c9a0', '#b8754a', '#fde0bd'], tuft: '#a87a4a', rock: ['#c8744a', '#8f4a2a'],
    rail: { rail: '#4a3a30', tie: '#7a4e2d' },
    cap: '#e9b27a',
  },
  volcan: {
    a: '#4a3b3b', b: '#413333', bed: '#6b5a52', bedEdge: '#2f2524', bank: '#6b5a52', water: '#ff6a13', shine: '#ffe08a', deep: '#8a1c0b', shallow: '#ffa23a', road: '#2c2625',
    canopy: ['#2b1f1d', '#3a2926', '#241917'], fruit: null, pine: ['#2b1f1d', '#3d2a26'], snow: false,
    crops: [['#5a4a42', '#4e3f38']],
    walls: ['#6b5750', '#5a4640', '#7a6258', '#4d3b35'], roofs: ['#2a1d1b', '#3b2a26', '#7f1d1d', '#1f1514'],
    dots: ['#fb923c', '#f97316', '#fde047'], tuft: '#2e2220', rock: ['#6a5d5d', '#3a3030'],
    rail: { rail: '#9ca3af', tie: '#3a2a26' },
    life: false,
    cap: '#ff7a1a',
    trunk: '#1f1514',
  },
  enfer: {
    a: '#5b1222', b: '#4e0f1d', bed: '#7a3a3a', bedEdge: '#3a0d14', bank: '#7a3a3a', water: '#ff3b1f', shine: '#ffd166', deep: '#7a0c0c', shallow: '#ff7a2f', road: '#241013',
    canopy: ['#3a0f18', '#4b1520', '#2d0b12'], fruit: null, pine: ['#2d0b12', '#431320'], snow: false,
    crops: [['#7a1f2e', '#6a1827']],
    walls: ['#2a1218', '#3a1a22', '#1f0d12', '#4a2029'], roofs: ['#c1121f', '#9d0208', '#e63946', '#7f0d14'],
    dots: ['#fb923c', '#ef4444', '#fde047'], tuft: '#7a1f2e', rock: ['#44272e', '#26121a'],
    rail: { rail: '#d1d5db', tie: '#2a0e14' },
    life: false,
    cap: '#ff5a1f',
    trunk: '#240c12',
  },
  bonbons: {
    a: '#fbc8de', b: '#f7b6d2', bed: '#fff1f7', bedEdge: '#e9a6c4', bank: '#fff1f7', water: '#7b4a2e', shine: '#d9a679', deep: '#4e2a18', shallow: '#a36b45', road: '#8a6a8a',
    canopy: ['#f472b6', '#fb9ec9', '#e879b0'], fruit: '#ffffff', pine: ['#7fe0c3', '#a5f0da'], snow: false,
    crops: [['#fde68a', '#fcd34d'], ['#a5f3fc', '#67e8f9'], ['#fbcfe8', '#f9a8d4']],
    walls: ['#b9794a', '#c98a5a', '#a86a3c', '#d9a06c'], roofs: ['#ffffff', '#fecdd3', '#a7f3d0', '#fde68a'],
    dots: ['#ffffff', '#a7f3d0', '#fde047'], tuft: '#f06ea9', rock: ['#f9a8d4', '#e879b0'],
    rail: { rail: '#8b5e83', tie: '#ffffff' },
    life: false,
    cap: '#ffffff',
    trunk: '#fff7ed',
  },
  lune: {
    a: '#b9bcc6', b: '#aeb1bd', bed: '#8f93a3', bedEdge: '#6d7183', bank: '#8f93a3', water: '#7aa2ff', shine: '#d6e4ff', deep: '#3f5fb8', shallow: '#a8c4ff', road: '#5b5f70',
    canopy: ['#9498a6', '#a3a7b5', '#868a98'], fruit: null, pine: ['#868a98', '#9498a6'], snow: false,
    crops: [['#c7cad4', '#b7bac6']],
    walls: ['#e5e7eb', '#d1d5db', '#f3f4f6', '#cbd5e1'], roofs: ['#94a3b8', '#64748b', '#38bdf8', '#e2e8f0'],
    dots: ['#e5e7eb', '#9ca3af', '#d1d5db'], tuft: '#8f93a3', rock: ['#a0a4b2', '#6f7384'],
    rail: { rail: '#334155', tie: '#94a3b8' },
    life: false,
    cap: '#f1f5f9',
  },
  neon: {
    a: '#121a3a', b: '#0e1530', bed: '#1f2c5c', bedEdge: '#0ea5c4', bank: '#1f2c5c', water: '#00e5ff', shine: '#b6fbff', deep: '#0a6c8a', shallow: '#22d3ee', road: '#0b1024',
    canopy: ['#ff2bd6', '#c026d3', '#ff5fe0'], fruit: '#00e5ff', pine: ['#00e5ff', '#22d3ee'], snow: false,
    crops: [['#3b1d6e', '#2d1556']],
    walls: ['#1e293b', '#273449', '#0f172a', '#312e81'], roofs: ['#ff2bd6', '#00e5ff', '#a3e635', '#f59e0b'],
    dots: ['#00e5ff', '#ff2bd6', '#a3e635'], tuft: '#7c3aed', rock: ['#3b3f7a', '#23265a'],
    rail: { rail: '#00e5ff', tie: '#ff2bd6' },
    life: false,
    cap: '#00e5ff',
    trunk: '#6d28d9',
  },
  fusion: {
    a: '#6b5b7a', b: '#615170', bed: '#e6e0f2', bedEdge: '#8b7fa8', bank: '#a8a0b8', water: '#a78bfa', shine: '#ede9fe', deep: '#5b21b6', shallow: '#c4b5fd', road: '#3f3a4f',
    canopy: ['#dce7f1', '#edf3f9', '#cbd9e8'], fruit: null, pine: ['#2f6b57', '#3b806a'], snow: false,
    crops: [['#e5edf6', '#d6e1ee']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#f8fbff', '#eef4fa', '#7f1d1d', '#e6eef7'],
    dots: ['#dbe7f3', '#fb923c', '#ffffff'], tuft: '#b4c4d6', rock: ['#8a96a5', '#4a3f3f'],
    rail: { rail: '#2b2638', tie: '#7a4e2d' },
    life: false,
  },
  ville: {
    a: '#9aa3ad', b: '#8f98a3', bed: '#e2dac4', bedEdge: '#a89f88', bank: '#e2dac4', water: '#4a90c8', shine: '#a5d1f0', deep: '#2c6a9a', shallow: '#7bb8e6', road: '#3d4450',
    canopy: ['#3f9d4a', '#4cae56', '#45a550'], fruit: null, pine: ['#2f7d4a', '#3a9158'], snow: false,
    crops: [['#7cc653', '#6bb745']],
    walls: ['#e8d9c0', '#c97b5b', '#b5bcc8', '#f0e6d2'], roofs: ['#5b6472', '#3f4752', '#7b4b3a', '#2f3640'],
    dots: ['#e5e7eb', '#fde68a', '#9ca3af'], tuft: '#7b8490', rock: ['#9ca3af', '#6b7280'],
    rail: { rail: '#3f4a5c', tie: '#7a4e2d' },
  },
}
