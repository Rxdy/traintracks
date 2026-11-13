// Environnements du décor : un par « chapitre » du Voyage, avec leurs réglages (quoi placer, en quelle quantité)
// et leur palette (couleurs de chaque élément ET de la voie : pas de rails enneigés sur un sol de prairie).
// Un environnement par « chapitre » du Voyage : le décor reste cohérent d'un niveau à l'autre, puis change.
// Durée pendant laquelle le décor se dévoile avant que le train ne démarre (0 : tout de suite, pour les tests).
export const timing = { revealMs: 2800 }

export type Theme = 'plaine' | 'foret' | 'automne' | 'montagne' | 'hiver'
export const THEMES: Theme[] = ['plaine', 'foret', 'automne', 'montagne', 'hiver']
export const LEVELS_PER_THEME = 10
export function themeForLevel(level: number): Theme {
  return THEMES[Math.floor((Math.max(1, level) - 1) / LEVELS_PER_THEME) % THEMES.length]
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
}
export const PARAMS: Record<Theme, Params> = {
  plaine: { river: 1, tree: 0.4, pine: 0.1, houseBase: 1, houseRatio: 0.12, fields: 2, peaks: 0, boulders: 0, snowmen: 0 },
  foret: { river: 0.5, tree: 0.85, pine: 0.6, houseBase: 0, houseRatio: 0, fields: 0, peaks: 0, boulders: 0.05, snowmen: 0 },
  automne: { river: 1, tree: 0.5, pine: 0.12, houseBase: 1, houseRatio: 0.12, fields: 2, peaks: 0, boulders: 0, snowmen: 0 },
  montagne: { river: 0.7, tree: 0.25, pine: 0.7, houseBase: 1, houseRatio: 0.05, fields: 0, peaks: 0.3, boulders: 0.2, snowmen: 0 },
  hiver: { river: 0.8, tree: 0.35, pine: 0.7, houseBase: 1, houseRatio: 0.1, fields: 0, peaks: 0.08, boulders: 0, snowmen: 0.2 },
}


export interface Pal {
  a: string // herbe / sol
  b: string // damier léger
  bed: string // lit de la voie
  bedEdge: string
  bank: string // berge
  water: string
  shine: string
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
}
export const PAL: Record<Theme, Pal> = {
  plaine: {
    a: '#9bd66f', b: '#8acb5f', bed: '#e6d9ab', bedEdge: '#c9b784', bank: '#e2d6a4', water: '#4aa8e8', shine: '#8fcdf5',
    canopy: ['#3f9d4a', '#4cae56', '#45a550'], fruit: '#ef4444', pine: ['#2f7d4a', '#3a9158'], snow: false,
    crops: [['#e9c75b', '#dcb549'], ['#7cc653', '#6bb745'], ['#b98a5a', '#a67a4c']],
    walls: ['#fdf3dc', '#fbd9d0', '#f9e5a6', '#ffffff'], roofs: ['#c2410c', '#9a3412', '#1d4ed8', '#b45309'],
    dots: ['#ffffff', '#fde68a', '#ffffff'], tuft: '#5fae45', rock: ['#9ca3af', '#6b7280'],
    rail: { rail: '#475569', tie: '#7a4e2d' },
  },
  foret: {
    a: '#68b563', b: '#5ba857', bed: '#d9c9a0', bedEdge: '#b8a57a', bank: '#cdbf94', water: '#3f9fd6', shine: '#85c8ee',
    canopy: ['#2f8a42', '#3a9a4c', '#2a7d3d'], fruit: null, pine: ['#25663d', '#2f7d4a'], snow: false,
    crops: [['#e9c75b', '#dcb549']],
    walls: ['#c79a63', '#b98a55', '#d2a770', '#a97c4d'], roofs: ['#5b3a21', '#4a2f1b', '#2f5d3a', '#6b4226'],
    dots: ['#fca5a5', '#fde68a', '#ffffff'], tuft: '#3f8f3f', rock: ['#9ca3af', '#6b7280'],
    rail: { rail: '#3f4a57', tie: '#5b3a21' },
  },
  automne: {
    a: '#d2c872', b: '#c7bd63', bed: '#e3cf9c', bedEdge: '#bfa56d', bank: '#d9c58b', water: '#5aa5c9', shine: '#9ccbe2',
    canopy: ['#e0792b', '#f0a03a', '#c4541f'], fruit: '#7c2d12', pine: ['#3d6b3a', '#4a7d44'], snow: false,
    crops: [['#e5b94a', '#d5a53a'], ['#c9833a', '#b9722d'], ['#a8794e', '#966a42']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#9a3412', '#7c2d12', '#b45309', '#78350f'],
    dots: ['#e0792b', '#b4361b', '#f0a03a'], tuft: '#a8892f', rock: ['#a39a8c', '#7a7165'],
    rail: { rail: '#57534e', tie: '#7c4a21' },
  },
  montagne: {
    a: '#a9c49a', b: '#9dba8e', bed: '#d3cab8', bedEdge: '#b3a892', bank: '#dfe6e8', water: '#55bfd6', shine: '#a6e2ee',
    canopy: ['#4a8a55', '#559860', '#3f7d4b'], fruit: null, pine: ['#2d6a4a', '#37805a'], snow: false,
    crops: [['#cdbf6a', '#bdaf5c']],
    walls: ['#c79a63', '#d9b98a', '#b98a55', '#e8d4b0'], roofs: ['#6b3a22', '#7c2d12', '#374151', '#9a3412'],
    dots: ['#d1d5db', '#e5e7eb', '#9ca3af'], tuft: '#7e9c70', rock: ['#9aa3ad', '#6b7280'],
    rail: { rail: '#52525b', tie: '#8b8b94' },
  },
  hiver: {
    a: '#f2f6fb', b: '#e5edf6', bed: '#cdd7e3', bedEdge: '#aebbcb', bank: '#ffffff', water: '#bfe4f5', shine: '#ffffff',
    canopy: ['#dce7f1', '#edf3f9', '#cbd9e8'], fruit: null, pine: ['#2f6b57', '#3b806a'], snow: true,
    crops: [['#e5edf6', '#d6e1ee']],
    walls: ['#f6e3c0', '#f3d1b0', '#efe0a6', '#fff4e0'], roofs: ['#f8fbff', '#eef4fa', '#f8fbff', '#e6eef7'],
    dots: ['#dbe7f3', '#cbd9e8', '#ffffff'], tuft: '#b4c4d6', rock: ['#b5bfcb', '#8a96a5'],
    rail: { rail: '#64748b', tie: '#dfe8f2' },
  },
}
