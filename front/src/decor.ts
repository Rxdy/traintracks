// Le décor des niveaux gagnés et le fond du menu sont en 3D (Three.js). Sans WebGL (très vieux appareil, certains
// navigateurs intégrés comme celui de VS Code), on retombe sur le décor dessiné en SVG : jamais d'écran vide.
let gl: boolean | null = null
export function webglAvailable(): boolean {
  if (gl !== null) return gl
  if (typeof WebGLRenderingContext === 'undefined') return (gl = false) // tests (jsdom), très vieux navigateurs
  try {
    const c = document.createElement('canvas')
    gl = !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    gl = false
  }
  return gl
}
