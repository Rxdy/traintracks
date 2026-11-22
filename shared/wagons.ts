// Les wagons à collectionner : une liste FIXE, partagée par le serveur (tirage, possession, ordre du train) et le navigateur
// (dessin : front/src/scenery3d/trainModel.ts). Chaque wagon a son type ET son coloris : on ne repeint pas un wagon.
// - base : des wagons courts, un vrai type de wagon par coloris (les trois premiers forment le train de départ) ;
// - fret : des wagons longs (1,5 à 2 fois un wagon court) qui comptent pour UNE place : un train de fret est plus long, c'est voulu.
export type WagonKind =
  | 'baggage' | 'coach' | 'gondola' | 'sleeper' | 'panorama' | 'dining' | 'mail' | 'reefer' | 'caboose' | 'cattle' | 'boxcar' | 'hopper'
  | 'milk' | 'wine' | 'salon' | 'crane' | 'horses' | 'fire'
  | 'flat' | 'logs' | 'autos' | 'boat' | 'tank' | 'containers' | 'livestock' | 'sheep' | 'elephant' | 'pipes'
  | 'hay' | 'tractors' | 'giraffe' | 'blade' | 'digger' | 'ballast' | 'stone' | 'plane' | 'lions'
export type WagonFamily = 'base' | 'fret'
export interface WagonDef {
  id: string
  name: string // le nom court dit au joueur (un ou deux mots) : « Bagages », « Vaches »…
  kindName: string // le type de wagon en entier (lecteurs d'écran)
  color: string
  kind: WagonKind
  family: WagonFamily
  length: number // en longueurs de wagon court (1 = wagon court)
}

export const WAGON_DEFS: readonly WagonDef[] = [
  { id: 'ambre', name: 'Bagages', kindName: 'fourgon à bagages', color: '#f59e0b', kind: 'baggage', family: 'base', length: 1 },
  { id: 'vert', name: 'Voyageurs', kindName: 'voiture de voyageurs', color: '#16a34a', kind: 'coach', family: 'base', length: 1 },
  { id: 'violet', name: 'Charbon', kindName: 'tombereau à charbon', color: '#8b5cf6', kind: 'gondola', family: 'base', length: 1 },
  { id: 'bleu', name: 'Couchettes', kindName: 'voiture-lits', color: '#2563eb', kind: 'sleeper', family: 'base', length: 1 },
  { id: 'ciel', name: 'Panoramique', kindName: 'voiture panoramique', color: '#38bdf8', kind: 'panorama', family: 'base', length: 1 },
  { id: 'rose', name: 'Restaurant', kindName: 'voiture-restaurant', color: '#ec4899', kind: 'dining', family: 'base', length: 1 },
  { id: 'orange', name: 'Poste', kindName: 'wagon postal', color: '#f97316', kind: 'mail', family: 'base', length: 1 },
  { id: 'citron', name: 'Frigo', kindName: 'wagon frigorifique', color: '#facc15', kind: 'reefer', family: 'base', length: 1 },
  { id: 'turquoise', name: 'Fourgon', kindName: 'fourgon de queue', color: '#14b8a6', kind: 'caboose', family: 'base', length: 1 },
  { id: 'chocolat', name: 'Bestiaux', kindName: 'wagon à bestiaux', color: '#8b5a2b', kind: 'cattle', family: 'base', length: 1 },
  { id: 'ardoise', name: 'Couvert', kindName: 'wagon couvert', color: '#475569', kind: 'boxcar', family: 'base', length: 1 },
  { id: 'sable', name: 'Céréales', kindName: 'trémie à céréales', color: '#d6a85a', kind: 'hopper', family: 'base', length: 1 },
  { id: 'lait', name: 'Lait', kindName: 'wagon à lait', color: '#e2e8f0', kind: 'milk', family: 'base', length: 1 },
  { id: 'vin', name: 'Vin', kindName: 'wagon à foudres', color: '#7f1d1d', kind: 'wine', family: 'base', length: 1 },
  { id: 'salon', name: 'Salon', kindName: 'voiture-salon', color: '#1e3a8a', kind: 'salon', family: 'base', length: 1 },
  { id: 'grue', name: 'Grue', kindName: 'wagon-grue', color: '#65a30d', kind: 'crane', family: 'base', length: 1 },
  { id: 'chevaux', name: 'Chevaux', kindName: 'wagon à chevaux', color: '#78350f', kind: 'horses', family: 'base', length: 1 },
  { id: 'pompiers', name: 'Pompiers', kindName: 'wagon des pompiers', color: '#b91c1c', kind: 'fire', family: 'base', length: 1 },
  { id: 'plateau', name: 'Plateau', kindName: 'wagon plat', color: '#6b7280', kind: 'flat', family: 'fret', length: 1.6 },
  { id: 'grumes', name: 'Grumes', kindName: 'wagon de bois', color: '#7c2d12', kind: 'logs', family: 'fret', length: 1.8 },
  { id: 'autos', name: 'Autos', kindName: 'porte-autos', color: '#1d4ed8', kind: 'autos', family: 'fret', length: 2 },
  { id: 'bateau', name: 'Bateau', kindName: 'wagon à bateau', color: '#0f766e', kind: 'boat', family: 'fret', length: 1.8 },
  { id: 'citerne', name: 'Citerne', kindName: 'wagon-citerne', color: '#e5e7eb', kind: 'tank', family: 'fret', length: 1.6 },
  { id: 'conteneurs', name: 'Conteneurs', kindName: 'porte-conteneurs', color: '#b91c1c', kind: 'containers', family: 'fret', length: 2 },
  { id: 'vaches', name: 'Vaches', kindName: 'wagon à bétail', color: '#a16207', kind: 'livestock', family: 'fret', length: 1.8 },
  { id: 'moutons', name: 'Moutons', kindName: 'wagon à bétail', color: '#65a30d', kind: 'sheep', family: 'fret', length: 1.6 },
  { id: 'elephant', name: 'Éléphant', kindName: 'wagon de cirque', color: '#be123c', kind: 'elephant', family: 'fret', length: 1.8 },
  { id: 'foin', name: 'Foin', kindName: 'wagon de foin', color: '#92400e', kind: 'hay', family: 'fret', length: 1.8 },
  { id: 'tracteurs', name: 'Tracteurs', kindName: 'porte-tracteurs', color: '#475569', kind: 'tractors', family: 'fret', length: 2 },
  { id: 'girafe', name: 'Girafe', kindName: 'wagon de cirque', color: '#7c3aed', kind: 'giraffe', family: 'fret', length: 1.6 },
  { id: 'eolienne', name: 'Éolienne', kindName: 'wagon à pale', color: '#334155', kind: 'blade', family: 'fret', length: 2 },
  { id: 'chantier', name: 'Chantier', kindName: 'wagon de chantier', color: '#ca8a04', kind: 'digger', family: 'fret', length: 2 },
  { id: 'ballast', name: 'Ballast', kindName: 'wagon à ballast', color: '#57534e', kind: 'ballast', family: 'fret', length: 1.6 },
  { id: 'pierres', name: 'Pierres', kindName: 'wagon de pierres', color: '#6b7280', kind: 'stone', family: 'fret', length: 1.6 },
  { id: 'avion', name: 'Avion', kindName: 'wagon à avion', color: '#0369a1', kind: 'plane', family: 'fret', length: 2 },
  { id: 'lions', name: 'Lions', kindName: 'cage de cirque', color: '#c2410c', kind: 'lions', family: 'fret', length: 1.6 },
  { id: 'tuyaux', name: 'Tuyaux', kindName: 'wagon à tuyaux', color: '#334155', kind: 'pipes', family: 'fret', length: 1.8 },
]

export const WAGON_IDS = WAGON_DEFS.map((w) => w.id)
export const wagonDef = (id: unknown): WagonDef | undefined => (typeof id === 'string' ? WAGON_DEFS.find((w) => w.id === id) : undefined)

/** Le train de départ : ambre, vert, violet. Ces trois wagons sont donnés à tout le monde. */
export const STARTER_TRAIN: readonly string[] = ['ambre', 'vert', 'violet']
export const DRAW_PRICE = 40 // pièces pour un tirage de la machine « Wagon surprise »
/** Chance de gagner à un tirage : 2 sur 3. Perdu : on ne gagne rien (les 3 rouleaux s'arrêtent sur des wagons différents). */
export const DRAW_WIN = { in: 2, of: 3 } as const
export const MAX_PER_WAGON = 6 // jusqu'à 6 exemplaires de chaque wagon : de quoi faire un train d'une seule sorte
export const TRAIN_SLOTS = 6 // places derrière la locomotive, toutes ouvertes dès le départ
export const COLLECTION_TOTAL = WAGON_DEFS.length * MAX_PER_WAGON

/** Les wagons que la machine peut encore donner : ceux qu'on a moins de 6 fois. */
export function drawPool(owned: Record<string, number>): string[] {
  return WAGON_IDS.filter((id) => (owned[id] ?? 0) < MAX_PER_WAGON)
}

/** Combien de wagons il reste à gagner pour tout avoir (6 de chaque). */
export function leftToWin(owned: Record<string, number>): number {
  return WAGON_IDS.reduce((n, id) => n + MAX_PER_WAGON - Math.min(MAX_PER_WAGON, owned[id] ?? 0), 0)
}

/** Un ordre de train valide : au plus 6 wagons connus, chacun pas plus de fois qu'on ne le possède. */
export function validTrain(cars: unknown, owned: Record<string, number>): cars is string[] {
  if (!Array.isArray(cars) || cars.length > TRAIN_SLOTS) return false
  const used: Record<string, number> = {}
  for (const id of cars) {
    if (!wagonDef(id)) return false
    used[id] = (used[id] ?? 0) + 1
    if (used[id]! > (owned[id] ?? 0)) return false
  }
  return true
}
