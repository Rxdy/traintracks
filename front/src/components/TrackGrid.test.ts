import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackGrid from './TrackGrid.vue'
import TrackCell from './TrackCell.vue'
import ClueNumber from './ClueNumber.vue'
import RailPiece from './RailPiece.vue'
import BlockedMark from './BlockedMark.vue'
import { samplePuzzle, type Puzzle } from '../puzzle'

const N = samplePuzzle.size
const ENTRY = samplePuzzle.entry // (2, 0)
const EXIT = samplePuzzle.exit // (7, 3)

type Wrapper = ReturnType<typeof mount>

function cellAt(wrapper: Wrapper, r: number, c: number) {
  return wrapper.findAllComponents(TrackCell)[r * N + c]
}

// Simule un glisser d'une case voisine à l'autre.
async function drag(
  wrapper: Wrapper,
  [r1, c1]: [number, number],
  [r2, c2]: [number, number],
) {
  await cellAt(wrapper, r1, c1).trigger('pointerdown')
  await cellAt(wrapper, r2, c2).trigger('pointerenter')
  window.dispatchEvent(new Event('pointerup'))
}

describe('TrackGrid — structure', () => {
  it('rend size × size cases et 2 × size compteurs', () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    expect(wrapper.findAllComponents(TrackCell)).toHaveLength(N * N)
    expect(wrapper.findAllComponents(ClueNumber)).toHaveLength(2 * N)
  })

  it('affiche d\'office le départ (vert) et la sortie (rouge)', () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(2)
    expect(cellAt(wrapper, ENTRY.row, ENTRY.col).findComponent(RailPiece).props('variant')).toBe('entry')
    expect(cellAt(wrapper, EXIT.row, EXIT.col).findComponent(RailPiece).props('variant')).toBe('exit')
  })
})

describe('TrackGrid — tracé au glisser', () => {
  it('trace un rail bleu entre deux cases', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await drag(wrapper, [4, 4], [4, 5])
    const a = cellAt(wrapper, 4, 4).findComponent(RailPiece)
    expect(a.exists()).toBe(true)
    expect(a.props('variant')).toBe('user')
    expect(a.props('sides')).toEqual(['right'])
    expect(cellAt(wrapper, 4, 5).findComponent(RailPiece).props('sides')).toEqual(['left'])
  })

  it('repasser sur une liaison existante l\'efface', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await drag(wrapper, [4, 4], [4, 5])
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(4) // entrée + sortie + 2
    await drag(wrapper, [4, 4], [4, 5])
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(2) // effacé
  })

  it('deux virages voisins ne se collent pas (le bug d\'origine)', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    // (1,1) = haut + gauche ; (2,1) = bas + droite, SANS liaison entre eux
    await drag(wrapper, [0, 1], [1, 1]) // haut de (1,1)
    await drag(wrapper, [1, 0], [1, 1]) // gauche de (1,1)
    await drag(wrapper, [2, 1], [3, 1]) // bas de (2,1)
    await drag(wrapper, [2, 1], [2, 2]) // droite de (2,1)

    expect(cellAt(wrapper, 1, 1).findComponent(RailPiece).props('sides')).toEqual(['top', 'left'])
    expect(cellAt(wrapper, 2, 1).findComponent(RailPiece).props('sides')).toEqual(['right', 'bottom'])
  })
})

describe('TrackGrid — croix', () => {
  it('clic droit pose puis enlève une croix', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await cellAt(wrapper, 4, 4).trigger('contextmenu')
    expect(wrapper.findAllComponents(BlockedMark)).toHaveLength(1)
    await cellAt(wrapper, 4, 4).trigger('contextmenu')
    expect(wrapper.findAllComponents(BlockedMark)).toHaveLength(0)
  })

  it('pas de croix possible sur le départ (déjà un rail)', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await cellAt(wrapper, ENTRY.row, ENTRY.col).trigger('contextmenu')
    expect(wrapper.findAllComponents(BlockedMark)).toHaveLength(0)
    expect(cellAt(wrapper, ENTRY.row, ENTRY.col).findComponent(RailPiece).exists()).toBe(true)
  })
})

describe('TrackGrid — effacer au tap', () => {
  it('taper une case supprime son rail', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await drag(wrapper, [4, 4], [4, 5])
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(4)
    // tap (pointerdown + pointerup, sans glisser) sur (4,4)
    await cellAt(wrapper, 4, 4).trigger('pointerdown')
    window.dispatchEvent(new Event('pointerup'))
    await wrapper.vm.$nextTick()
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(2)
  })
})

describe('TrackGrid — annuler / rétablir', () => {
  function toolbarButton(wrapper: Wrapper, label: string) {
    return wrapper.findAll('button').find((b) => b.attributes('aria-label') === label)!
  }

  it('annule le dernier tracé, puis le rétablit', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await drag(wrapper, [4, 4], [4, 5])
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(4)

    await toolbarButton(wrapper, 'Annuler').trigger('click')
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(2)

    await toolbarButton(wrapper, 'Rétablir').trigger('click')
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(4)
  })

  it('les boutons sont désactivés quand il n\'y a rien à faire', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    expect(toolbarButton(wrapper, 'Annuler').attributes('disabled')).toBeDefined()
    expect(toolbarButton(wrapper, 'Rétablir').attributes('disabled')).toBeDefined()
    await drag(wrapper, [4, 4], [4, 5])
    expect(toolbarButton(wrapper, 'Annuler').attributes('disabled')).toBeUndefined()
  })

  it('« Effacer tout » retire les rails du joueur', async () => {
    const wrapper = mount(TrackGrid, { props: { puzzle: samplePuzzle } })
    await drag(wrapper, [4, 4], [4, 5])
    await drag(wrapper, [6, 6], [6, 7])
    await toolbarButton(wrapper, 'Effacer tout').trigger('click')
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(6) // premier toucher : rien n'est effacé, le bouton demande confirmation
    await wrapper.find('[data-test=clear]').trigger('click')
    expect(wrapper.findAllComponents(RailPiece)).toHaveLength(2) // reste entrée + sortie
  })
})

describe('TrackGrid — taille variable', () => {
  it("s'adapte à une autre taille de grille", () => {
    const tiny: Puzzle = {
      size: 2,
      rowClues: [1, 1],
      colClues: [1, 1],
      entry: { row: 0, col: 0, dir: 'left' },
      exit: { row: 1, col: 1, dir: 'down' },
    }
    const wrapper = mount(TrackGrid, { props: { puzzle: tiny } })
    expect(wrapper.findAllComponents(TrackCell)).toHaveLength(4)
    expect(wrapper.findAllComponents(ClueNumber)).toHaveLength(4)
  })
})
