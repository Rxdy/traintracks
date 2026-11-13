// Installation de la PWA : capture l'événement `beforeinstallprompt` (Chrome,
// Edge, Android…) dès le chargement du module, car il peut arriver avant que
// l'interface soit montée. Safari iOS n'a pas cet événement : on y affiche un
// mode d'emploi (Partager → Sur l'écran d'accueil).
import { computed, ref } from 'vue'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const deferred = ref<InstallPromptEvent | null>(null)
const installed = ref(false)

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // on garde l'événement pour le déclencher depuis notre bouton
    deferred.value = e as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferred.value = null
  })
}

// Faut-il proposer l'installation ? Oui si le navigateur sait la faire, ou
// sur iOS (instructions), et seulement si l'appli n'est pas déjà installée.
export const canPropose = computed(
  () => !installed.value && !isStandalone() && (deferred.value !== null || isIOS()),
)
export const needsManualSteps = computed(() => deferred.value === null && isIOS())

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'manual'> {
  const ev = deferred.value
  if (!ev) return 'manual'
  await ev.prompt()
  const { outcome } = await ev.userChoice
  deferred.value = null // l'événement ne peut servir qu'une fois
  return outcome
}
