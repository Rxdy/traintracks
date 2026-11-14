import type { Theme } from './themes'

// Ciel de chaque environnement : fond de l'accueil, et horizon du décor 3D (plateau incliné, vue de la cabine).
export interface Sky { top: string; mid: string; low: string; sun: string; sunCore: string; cloud: string; night?: boolean }
export const SKY: Record<Theme, Sky> = {
  plaine: { top: '#a5d8ff', mid: '#d7efff', low: '#f1faff', sun: '#fff7c2', sunCore: '#fde68a', cloud: '#ffffff' },
  foret: { top: '#9ad0c0', mid: '#cfeadf', low: '#eef8f2', sun: '#f4f9c8', sunCore: '#e5ee9a', cloud: '#f4fbf7' },
  automne: { top: '#f5c98e', mid: '#fbe3bd', low: '#fff4e2', sun: '#ffe9b0', sunCore: '#fbbf6a', cloud: '#fff8ee' },
  montagne: { top: '#8fb8e8', mid: '#c4daf3', low: '#e6f0fb', sun: '#fff7c2', sunCore: '#fde68a', cloud: '#ffffff' },
  hiver: { top: '#c3d9ee', mid: '#e1edf8', low: '#f7fbff', sun: '#ffffff', sunCore: '#eaf4ff', cloud: '#ffffff' },
  ville: { top: '#9fb4c9', mid: '#c9d6e3', low: '#e8eef4', sun: '#fff3c9', sunCore: '#fde68a', cloud: '#eef2f6' },
  desert: { top: '#8fd0f0', mid: '#fde9b8', low: '#fff4d6', sun: '#fff1b0', sunCore: '#fcd34d', cloud: '#fffaf0' },
  tropical: { top: '#59c7e8', mid: '#a8e6f0', low: '#e0f8f8', sun: '#fff7c2', sunCore: '#fde047', cloud: '#ffffff' },
  canyon: { top: '#f0a878', mid: '#f8cfa6', low: '#fde8d0', sun: '#ffe0a0', sunCore: '#fb923c', cloud: '#fff1e6' },
  volcan: { top: '#5a2a2a', mid: '#a8472f', low: '#e08a4a', sun: '#ffb27a', sunCore: '#ff6a2e', cloud: '#7a5048' },
  enfer: { top: '#2a0d12', mid: '#6b1a1a', low: '#b8341c', sun: '#ff7a3a', sunCore: '#ff3b1f', cloud: '#5a2a2a' },
  bonbons: { top: '#ffc2e2', mid: '#ffdff0', low: '#fff1fa', sun: '#fff0c2', sunCore: '#ffd6ef', cloud: '#ffffff' },
  lune: { top: '#05060f', mid: '#10132a', low: '#1d2142', sun: '#e8ecf5', sunCore: '#d3d8e6', cloud: '#2a2f55', night: true },
  neon: { top: '#150a33', mid: '#33105e', low: '#6a1f8f', sun: '#ff8ae6', sunCore: '#f0abfc', cloud: '#4a2a80', night: true },
  fusion: { top: '#9fd6ff', mid: '#f2c9b8', low: '#ffe2c2', sun: '#ffd6a0', sunCore: '#fb923c', cloud: '#ffffff' },
}
