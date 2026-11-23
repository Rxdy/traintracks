// Regroupe les pièces identiques du décor en UN seul dessin (InstancedMesh).
//
// Un niveau gagné affiche un monde de plus de 1 100 arbres, chacun fait de 5 à 7 pièces (tronc, cônes ou boules de feuillage) plus une
// ombre au sol : près de 8 000 objets, soit ~14 600 appels de dessin par image (la passe d'ombre redessine tout une seconde fois). Un
// téléphone ne suit pas (WebKit coûte cher par appel de dessin), d'où des saccades. Or ces pièces n'utilisent que 142 formes et 89
// matériaux : on les dessine par paquets (même forme, même matériau, mêmes ombres), soit quelques dizaines d'appels.
//
// Les groupes d'origine restent en place et continuent d'être animés comme avant (pousse avec rebond, balancement du vent) : seul leur
// contenu passe dans les paquets. À chaque image, `update()` recopie la position de chaque groupe dans ses pièces.
import * as THREE from 'three'

interface Part {
  group: THREE.Object3D
  local: THREE.Matrix4 // position de la pièce DANS son groupe (fixe)
}

export interface Batches {
  /** À appeler à chaque image, après l'animation des groupes. */
  update(): void
  /** Nombre de paquets créés et de pièces absorbées (pour les tests et le diagnostic). */
  stats: { batches: number; parts: number }
}

export function batchGroups(root: THREE.Object3D, groups: THREE.Object3D[]): Batches {
  const buckets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; cast: boolean; recv: boolean; order: number; parts: Part[] }>()
  const mine = new Set(groups)

  for (const group of groups) {
    if (group.parent !== root) continue // seuls les groupes posés directement dans le monde : leur place dans le monde est leur propre matrice
    const found: { mesh: THREE.Mesh; mat: THREE.Material; local: THREE.Matrix4 }[] = []
    const walk = (o: THREE.Object3D, local: THREE.Matrix4): void => {
      for (const child of o.children) {
        if (mine.has(child)) continue // un autre groupe animé à l'intérieur : il a sa propre vie
        child.updateMatrix()
        const m = local.clone().multiply(child.matrix)
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && !(mesh as unknown as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material)) found.push({ mesh, mat: mesh.material, local: m })
        else if (!mesh.isMesh) walk(child, m)
      }
    }
    walk(group, new THREE.Matrix4())
    for (const { mesh, mat, local } of found) {
      const key = [mesh.geometry.uuid, mat.uuid, +mesh.castShadow, +mesh.receiveShadow, mesh.renderOrder].join('|')
      let b = buckets.get(key)
      if (!b) buckets.set(key, (b = { geo: mesh.geometry, mat, cast: mesh.castShadow, recv: mesh.receiveShadow, order: mesh.renderOrder, parts: [] }))
      b.parts.push({ group, local })
      mesh.parent?.remove(mesh) // la pièce d'origine n'est plus dessinée : son paquet la remplace
    }
  }

  const meshes: { inst: THREE.InstancedMesh; parts: Part[] }[] = []
  let parts = 0
  for (const b of buckets.values()) {
    const inst = new THREE.InstancedMesh(b.geo, b.mat, b.parts.length)
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    inst.castShadow = b.cast
    inst.receiveShadow = b.recv
    inst.renderOrder = b.order
    inst.frustumCulled = false // la forêt est presque toujours entièrement à l'écran, et les cases bougent (balancement)
    root.add(inst)
    meshes.push({ inst, parts: b.parts })
    parts += b.parts.length
  }

  const used = new Set<THREE.Object3D>()
  for (const { parts: list } of meshes) for (const p of list) used.add(p.group)
  const m = new THREE.Matrix4()
  const update = (): void => {
    for (const g of used) g.updateMatrix() // l'animation a changé leur position, leur échelle ou leur rotation : une fois par groupe
    for (const { inst, parts: list } of meshes) {
      for (let i = 0; i < list.length; i++) {
        const { group, local } = list[i]!
        m.multiplyMatrices(group.matrix, local)
        inst.setMatrixAt(i, m)
      }
      inst.instanceMatrix.needsUpdate = true
    }
  }
  update()
  return { update, stats: { batches: meshes.length, parts } }
}
