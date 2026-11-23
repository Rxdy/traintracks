import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { batchGroups } from './batching'

// Un « arbre » : un groupe animé qui contient un tronc et deux boules, posé dans le monde.
function tree(root: THREE.Group, x: number, geo: THREE.BufferGeometry, trunk: THREE.Material, leaf: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  g.position.set(x, 0, 0)
  const t = new THREE.Mesh(geo, trunk)
  t.position.y = 0.2
  t.castShadow = true
  const a = new THREE.Mesh(geo, leaf)
  a.position.y = 0.6
  a.castShadow = true
  const b = new THREE.Mesh(geo, leaf)
  b.position.set(0.1, 0.8, 0)
  b.castShadow = true
  g.add(t, a, b)
  root.add(g)
  return g
}

describe('regroupement des pièces identiques du décor', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const trunk = new THREE.MeshStandardMaterial({ color: '#7a4e2d' })
  const leaf = new THREE.MeshStandardMaterial({ color: '#2f7d4a' })

  it('100 arbres de 3 pièces : 300 objets deviennent 2 paquets (tronc, feuillage), et les groupes restent dans le monde', () => {
    const root = new THREE.Group()
    const groups = Array.from({ length: 100 }, (_, i) => tree(root, i, geo, trunk, leaf))
    const before = root.children.length
    const { stats } = batchGroups(root, groups)
    expect(stats).toEqual({ batches: 2, parts: 300 })
    const insts = root.children.filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh)
    expect(insts.map((i) => i.count).sort()).toEqual([100, 200])
    expect(insts.every((i) => i.castShadow)).toBe(true)
    expect(root.children.length).toBe(before + 2) // les 100 groupes d'origine sont toujours là
    expect(groups.every((g) => g.children.length === 0)).toBe(true) // leurs pièces sont dans les paquets
  })

  it('la position de chaque pièce suit son groupe : pousse (échelle) et balancement (rotation) se voient dans le paquet', () => {
    const root = new THREE.Group()
    const g = tree(root, 5, geo, trunk, leaf)
    const { update } = batchGroups(root, [g])
    const trunkInst = root.children.find((o) => (o as THREE.InstancedMesh).isInstancedMesh && (o as THREE.InstancedMesh).count === 1) as THREE.InstancedMesh
    const at = (inst: THREE.InstancedMesh): THREE.Vector3 => {
      const m = new THREE.Matrix4()
      inst.getMatrixAt(0, m)
      return new THREE.Vector3().setFromMatrixPosition(m)
    }
    const p0 = at(trunkInst)
    expect([p0.x, p0.y, p0.z].map((n) => Math.round(n * 1000) / 1000 + 0)).toEqual([5, 0.2, 0])
    g.scale.setScalar(2) // la pousse
    g.position.x = 7
    update()
    const p = at(trunkInst)
    expect(p.x).toBeCloseTo(7)
    expect(p.y).toBeCloseTo(0.4)
    g.scale.setScalar(1)
    g.rotation.z = Math.PI / 2 // le vent : la pièce à y = 0.2 passe sur le côté
    update()
    const q = at(trunkInst)
    expect(q.x).toBeCloseTo(7 - 0.2)
    expect(q.y).toBeCloseTo(0)
  })

  it('ne touche pas aux pièces à plusieurs matériaux, ni aux groupes qui ne sont pas posés directement dans le monde', () => {
    const root = new THREE.Group()
    const multi = new THREE.Group()
    multi.add(new THREE.Mesh(geo, [trunk, leaf]))
    root.add(multi)
    const nested = new THREE.Group()
    const outer = new THREE.Group()
    outer.add(nested)
    nested.add(new THREE.Mesh(geo, leaf))
    root.add(outer)
    const { stats } = batchGroups(root, [multi, nested])
    expect(stats).toEqual({ batches: 0, parts: 0 })
    expect(multi.children.length).toBe(1)
    expect(nested.children.length).toBe(1)
  })

  it('garde à part les pièces qui n\'ont pas les mêmes ombres', () => {
    const root = new THREE.Group()
    const g = new THREE.Group()
    const a = new THREE.Mesh(geo, leaf)
    a.castShadow = true
    const b = new THREE.Mesh(geo, leaf) // même forme, même matériau, mais sans ombre (ex. la tache d'ombre au sol)
    g.add(a, b)
    root.add(g)
    expect(batchGroups(root, [g]).stats.batches).toBe(2)
  })
})
