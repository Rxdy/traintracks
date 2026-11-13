import { onMounted, onUnmounted, ref } from 'vue'

// Écran de téléphone (640 px ou moins) : la mise en page de fin de partie change (pas de fenêtre sur la grille).
export function useCompact() {
  const compact = ref(false)
  let mq: MediaQueryList | null = null
  const update = () => (compact.value = !!mq?.matches)
  onMounted(() => {
    mq = window.matchMedia?.('(max-width: 640px)') ?? null
    if (mq) {
      update()
      mq.addEventListener?.('change', update)
    }
  })
  onUnmounted(() => mq?.removeEventListener?.('change', update))
  return compact
}
