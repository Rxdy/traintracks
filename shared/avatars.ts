// Avatars : une liste FIXE, choisie dans le jeu (personne n'envoie d'image). Partagée par le serveur (prix, achat) et le navigateur
// (affichage). Les dessins sont dans front/src/avatars/svg.ts. Les 8 premiers sont gratuits et donnés à tous ; les autres s'achètent avec les pièces.
export type AvatarFamily = 'gratuit' | 'personnage' | 'animal' | 'train' | 'decor'
export interface AvatarDef { id: string; price: number; family: AvatarFamily }

export const AVATARS: readonly AvatarDef[] = [
  { id: 'loco', price: 0, family: 'gratuit' },
  { id: 'wagon', price: 0, family: 'gratuit' },
  { id: 'gare', price: 0, family: 'gratuit' },
  { id: 'conducteur', price: 0, family: 'gratuit' },
  { id: 'controleur', price: 0, family: 'gratuit' },
  { id: 'chat', price: 0, family: 'gratuit' },
  { id: 'lapin', price: 0, family: 'gratuit' },
  { id: 'canard', price: 0, family: 'gratuit' },
  { id: 'chef', price: 150, family: 'personnage' },
  { id: 'mecano', price: 150, family: 'personnage' },
  { id: 'voyageur', price: 150, family: 'personnage' },
  { id: 'cowboy', price: 300, family: 'personnage' },
  { id: 'astronaute', price: 300, family: 'personnage' },
  { id: 'robot', price: 500, family: 'personnage' },
  { id: 'ecureuil', price: 150, family: 'animal' },
  { id: 'hibou', price: 150, family: 'animal' },
  { id: 'cerf', price: 300, family: 'animal' },
  { id: 'aigle', price: 300, family: 'animal' },
  { id: 'perroquet', price: 300, family: 'animal' },
  { id: 'loup', price: 500, family: 'animal' },
  { id: 'metro', price: 150, family: 'train' },
  { id: 'tram', price: 150, family: 'train' },
  { id: 'diesel', price: 150, family: 'train' },
  { id: 'fret', price: 150, family: 'train' },
  { id: 'tgv', price: 300, family: 'train' },
  { id: 'shinkansen', price: 300, family: 'train' },
  { id: 'suisse', price: 300, family: 'train' },
  { id: 'monorail', price: 300, family: 'train' },
  { id: 'cremaillere', price: 300, family: 'train' },
  { id: 'us', price: 300, family: 'train' },
  { id: 'orient', price: 500, family: 'train' },
  { id: 'neige', price: 150, family: 'decor' },
  { id: 'cactus', price: 150, family: 'decor' },
  { id: 'palmier', price: 150, family: 'decor' },
  { id: 'moulin', price: 150, family: 'decor' },
  { id: 'foret', price: 150, family: 'decor' },
  { id: 'ville', price: 300, family: 'decor' },
  { id: 'sucette', price: 150, family: 'decor' },
  { id: 'lune', price: 300, family: 'decor' },
  { id: 'neon', price: 500, family: 'decor' },
]

export const AVATAR_IDS: readonly string[] = AVATARS.map((a) => a.id)
export const FREE_AVATARS: readonly string[] = AVATARS.filter((a) => a.price === 0).map((a) => a.id)
export const avatarOf = (id: unknown): AvatarDef | undefined => AVATARS.find((a) => a.id === id)
export const DEFAULT_AVATAR = 'loco'
