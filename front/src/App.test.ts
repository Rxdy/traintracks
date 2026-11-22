import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { fakeServer } from './testServer'
import App from './App.vue'
import TrackGrid from './components/TrackGrid.vue'
import TrainRun from './components/TrainRun.vue'
import { logout, user } from './auth'

const IDS: Record<string, string> = {
  'Puzzle du jour': 'daily',
  Tutoriel: 'tuto',
  Classement: 'ranking',
  Statistiques: 'stats',
  Compte: 'account',
}
async function open(wrapper: ReturnType<typeof mount>, label: string) {
  await wrapper.find(`[data-test=nav-${IDS[label]}]`).trigger('click')
}

// Simule un joueur connecté (le cookie de session et le serveur sont testés ailleurs), puis revient à l'accueil.
async function signUp(w: ReturnType<typeof mount>, email = 'rudy@example.com') {
  user.value = { name: 'rudy', email, provider: 'local' }
  await w.vm.$nextTick()
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    logout()
    fakeServer()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('l\'accueil est le Voyage : niveau en cours + gros bouton, sans liste ni taille', () => {
    const w = mount(App)
    expect(w.find('h1').text()).toContain('Train Tracks')
    expect(w.find('[data-test=home-level]').text()).toBe('Niveau 1')
    expect(w.find('[data-test=play]').attributes('aria-label')).toBe('Commencer')
    expect(w.find('[data-test=play]').text()).not.toMatch(/Commencer|Continuer/) // seulement l'icône ▶
    expect(w.find('.hero-cta').text()).toBe('▶')
    expect(w.find('[data-test=play]').text()).toContain('Niveau 1')
    expect(w.find('[data-test=landscape]').exists()).toBe(true)
    expect(w.findAll('[data-test=level]')).toHaveLength(0)
    expect(w.text()).not.toMatch(/\d×\d/)
  })

  it('6 petits cubes (3 de chaque côté du grand) mènent aux autres écrans, sans menu déroulant', async () => {
    const w = mount(App)
    expect(w.find('[data-test=menu]').exists()).toBe(false)
    const sides = w.findAll('.side')
    expect(sides).toHaveLength(2)
    expect(sides[0].findAll('.mini').map((m) => m.attributes('data-test'))).toEqual(['nav-daily', 'nav-tuto', 'nav-ranking'])
    expect(sides[1].findAll('.mini').map((m) => m.attributes('data-test'))).toEqual(['nav-stats', 'nav-train', 'nav-account'])
    await open(w, 'Tutoriel')
    expect(w.find('[data-test=tutorial]').exists()).toBe(true)
    expect(w.find('[data-test=landscape]').exists()).toBe(true) // le décor suit
    expect(w.find('[data-test=content]').classes()).toContain('panel')
    await w.find('[data-test=home]').trigger('click')
    expect(w.find('[data-test=play]').exists()).toBe(true)
  })

  it('le titre n\'a plus d\'emoji, et le décor contient un train animé', () => {
    const w = mount(App)
    expect(w.find('h1').text()).toBe('Train Tracks')
    // La locomotive est dessinée à gauche : le train qui roule vers la droite
    // doit être retourné, celui qui roule vers la gauche non.
    expect(w.find('[data-test=train-right] g').attributes('transform')).toContain('scale(-1 1)')
    expect(w.find('[data-test=train-left] use').exists()).toBe(true)
    expect(w.find('[data-test=train-left] g').exists()).toBe(false)
  })

  it('Du jour et Stats : verrouillés (désactivés, filtre + cadenas) tant qu\'on n\'est pas connecté', async () => {
    const w = mount(App)
    for (const id of ['daily', 'stats']) {
      const cube = w.find(`[data-test=nav-${id}]`)
      expect(cube.find('[data-test=lock]').exists(), id).toBe(true)
      expect(cube.attributes('disabled'), id).toBeDefined()
      await cube.trigger('click') // sans effet : pas de redirection
      expect(w.find('[data-test=play]').exists(), id).toBe(true)
      expect(w.find('[data-test=auth]').exists(), id).toBe(false)
    }
    for (const id of ['tuto', 'account']) {
      expect(w.find(`[data-test=nav-${id}] [data-test=lock]`).exists(), id).toBe(false)
      expect(w.find(`[data-test=nav-${id}]`).attributes('disabled'), id).toBeUndefined()
    }
    // connecté : tout se déverrouille
    await signUp(w, 'lock@b.fr')
    for (const id of ['daily', 'stats']) {
      expect(w.find(`[data-test=nav-${id}] [data-test=lock]`).exists(), id).toBe(false)
      expect(w.find(`[data-test=nav-${id}]`).attributes('disabled'), id).toBeUndefined()
    }
  })

  it('compte : formulaire quand déconnecté', async () => {
    const w = mount(App)
    await open(w, 'Compte')
    expect(w.find('[data-test=auth]').exists()).toBe(true)
  })

  it('en partie : plus de menu ni de titre ; Quitter les ramène', async () => {
    const w = mount(App)
    await flushPromises()
    await w.find('[data-test=play]').trigger('click')
    await flushPromises()
    expect(w.findComponent(TrackGrid).exists()).toBe(true)
    expect(w.find('.mini').exists()).toBe(false)
    expect(w.find('[data-test=landscape]').exists()).toBe(false)
    expect(w.find('h1').exists()).toBe(false)
    expect(w.find('[data-test=level-title]').text()).toBe('Niveau 1')
    expect(w.text()).not.toMatch(/\d×\d/)
    await w.find('[data-test=quit]').trigger('click')
    expect(w.find('.mini').exists()).toBe(true)
    expect(w.find('[data-test=play]').exists()).toBe(true)
  })

  it('puzzle du jour : accessible une fois connecté, salon puis partie sans menu', async () => {
    const w = mount(App)
    await signUp(w)
    await open(w, 'Puzzle du jour')
    await flushPromises()
    expect(w.findComponent(TrackGrid).exists()).toBe(false)
    expect(w.find('[data-test=start]').exists()).toBe(true)
    await w.find('[data-test=start]').trigger('click')
    await flushPromises()
    expect(w.findComponent(TrackGrid).exists()).toBe(true)
    expect(w.find('h1').exists()).toBe(false)
  })

  async function playDaily(w: ReturnType<typeof mount>) {
    const { levels } = await import('./testLevels')
    await w.find('[data-test=start]').trigger('click')
    await flushPromises()
    const sol = levels[0].solution // le faux serveur donne la grille du niveau 1 comme grille du jour
    await w.find(`[data-r="${sol[0][0]}"][data-c="${sol[0][1]}"]`).trigger('pointerdown')
    for (const [r, c] of sol.slice(1)) await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await flushPromises()
    w.findComponent(TrainRun).vm.$emit('done') // le train est passé : le résultat s'affiche
    await flushPromises()
  }

  it('puzzle du jour : le serveur valide, le premier temps compte et rapporte des pièces', async () => {
    const w = mount(App, { attachTo: document.body })
    await signUp(w)
    await open(w, 'Puzzle du jour')
    await flushPromises()
    expect(w.find('[data-test=already]').exists()).toBe(false)
    await playDaily(w)
    expect(w.find('[data-test=result-time]').text()).toContain('1:23') // temps officiel du serveur
    expect(w.find('[data-test=receipt-total]').text()).toContain('+20')
    expect(w.find('[data-test=coins-value]').text()).toBe('20')
    // pas de bouton « niveau suivant » ni d'aides dans le puzzle du jour
    expect(w.find('[data-test=next]').exists()).toBe(false)
    expect(w.find('[data-test=aids]').exists()).toBe(false)
    w.unmount()
  })

  it('puzzle du jour : rejouer est possible mais le temps n\'est plus compté', async () => {
    const w = mount(App, { attachTo: document.body })
    await signUp(w)
    await open(w, 'Puzzle du jour')
    await flushPromises()
    await playDaily(w)
    await w.find('[data-test=quit]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=already]').text()).toContain('1:23')
    expect(w.find('[data-test=start]').text()).toBe('Rejouer')
    await playDaily(w)
    expect(w.find('[data-test=not-counted]').exists()).toBe(true)
    expect(w.find('[data-test=coins-value]').text()).toBe('20') // pas de pièces en plus
    w.unmount()
  })

  it('refuse un mauvais mot de passe', async () => {
    const w = mount(App)
    await open(w, 'Compte')
    expect(w.find('[data-test=google-off]').exists()).toBe(true)
    await w.find('[data-test=email]').setValue('inconnu@example.com')
    await w.find('[data-test=password]').setValue('nope')
    await w.find('[data-test=auth-form]').trigger('submit')
    await vi.waitFor(() => expect(w.find('[data-test=error]').exists()).toBe(true))
  })

  it('statistiques : affiche le niveau en cours une fois connecté', async () => {
    const w = mount(App)
    await signUp(w, 'a@b.fr')
    await open(w, 'Statistiques')
    await flushPromises()
    expect(w.find('[data-test=highest]').text()).toBe('1')
    expect(w.find('[data-test=count]').text()).toBe('0')
  })

  it('dernier niveau disponible : « de nouveaux niveaux arrivent bientôt », pas de bouton Suivant, accueil sans jeu', async () => {
    const { levels } = await import('./testLevels')
    fakeServer(levels.length - 1) // un seul niveau reste
    const w = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-test=home-level]').text()).toBe('Niveau ' + levels.length)
    await w.find('[data-test=play]').trigger('click')
    await flushPromises()
    const sol = levels[levels.length - 1].solution
    await w.find(`[data-r="${sol[0][0]}"][data-c="${sol[0][1]}"]`).trigger('pointerdown')
    for (const [r, c] of sol.slice(1)) await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await flushPromises()
    w.findComponent(TrainRun).vm.$emit('done')
    await flushPromises()
    expect(w.find('[data-test=coming-soon]').text()).toContain('arrivent bientôt') // sur le store, à la place du bouton
    expect(w.find('[data-test=next]').exists()).toBe(false)
    await w.find('[data-test=quit]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=coming-soon]').exists()).toBe(true)
    expect(w.find('[data-test=play]').attributes('disabled')).toBeDefined()
    w.unmount()
  })

  it('victoire : bouton niveau suivant, puis l\'accueil propose le niveau 2', async () => {
    const { levels } = await import('./testLevels')
    const w = mount(App, { attachTo: document.body })
    await flushPromises()
    await w.find('[data-test=play]').trigger('click')
    await flushPromises()
    // pas de flèches ‹ › en partie : le bouton suivant n'existe qu'à la victoire
    expect(w.find('[data-test=prev]').exists()).toBe(false)
    expect(w.find('[data-test=next-arrow]').exists()).toBe(false)
    expect(w.find('[data-test=next]').exists()).toBe(false)
    const zoneBefore = w.find('.win-zone')
    expect(zoneBefore.exists()).toBe(true) // place réservée avant la victoire
    const sol = levels[0].solution
    await w.find(`[data-r="${sol[0][0]}"][data-c="${sol[0][1]}"]`).trigger('pointerdown')
    for (const [r, c] of sol.slice(1)) await w.find(`[data-r="${r}"][data-c="${c}"]`).trigger('pointerenter')
    window.dispatchEvent(new Event('pointerup'))
    await flushPromises() // le faux serveur vérifie le tracé
    // 1) le train passe ; le résultat n'existe pas encore
    expect(w.find('[data-test=train]').exists()).toBe(true)
    expect(w.find('.overlay').classes()).not.toContain('open') // la fenêtre de fin arrive avec le récapitulatif, à l'arrivée du train
    // 2) le train est arrivé : la fenêtre de fin s'ouvre au centre avec le récapitulatif ; « Niveau suivant » est proposé
    w.findComponent(TrainRun).vm.$emit('done')
    await flushPromises()
    expect(w.find('.overlay').classes()).toContain('open')
    expect(w.find('.overlay [data-test=finish]').exists()).toBe(true) // le récapitulatif est dans la fenêtre de fin, pas sur le décor
    expect(w.find('.finish--inline').exists()).toBe(false)
    expect(w.find('[data-test=finish] [data-test=result-time]').text()).toContain('0:01') // temps officiel du serveur (1000 ms)
    expect(w.find('[data-test=win]').exists()).toBe(true)
    expect(w.find('[data-test=coins-value]').text()).toBe('15') // pièces gagnées, d'après le serveur, visibles en partie
    // gains présentés comme une facture : une ligne par gain, montant à droite, puis le total avec la pièce
    const lines = w.findAll('[data-test=receipt-line]').map((l) => l.text())
    expect(lines).toEqual(['Victoire+10', 'Sans aide+5'])
    expect(w.find('[data-test=receipt-total]').text()).toBe('Total+15')
    expect(w.find('[data-test=receipt-total] [data-test=coin-icon]').exists()).toBe(true)
    expect(w.find('[data-test=finish]').text()).not.toMatch(/🎉|🏆|⏱/) // pas d'emoji de fête
    expect(w.find('.overlay [data-test=finish] [data-test=next]').exists()).toBe(true) // sous le récapitulatif
    expect(w.find('[data-test=replay-trip]').exists()).toBe(true) // « Revoir le trajet » à côté
    expect(w.find('.win-zone').element).toBe(zoneBefore.element) // même zone : pas de saut
    await w.find('[data-test=quit]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=home-level]').text()).toBe('Niveau 2')
    expect(w.find('[data-test=play]').attributes('aria-label')).toBe('Continuer')
    await w.find('[data-test=play]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test=level-title]').text()).toBe('Niveau 2')
    w.unmount()
  })
})

describe('icônes du menu', () => {
  beforeEach(() => {
    localStorage.clear()
    logout()
    fakeServer()
  })
  afterEach(() => vi.unstubAllGlobals())
  it('chaque cube a son illustration (plus d\'emoji) et des libellés explicites', () => {
    const w = mount(App)
    const icons = w.findAll('.mini svg').map((s) => s.attributes('data-icon'))
    expect(icons).toEqual(['daily', 'tuto', 'ranking', 'stats', 'train', 'account'])
    expect(w.findAll('.mini .lbl').map((l) => l.text())).toEqual(['Puzzle du jour', 'Tutoriel', 'Classement', 'Statistiques', 'Mon train', 'Compte'])
    expect(w.find('[data-test=day]').text()).toBe(String(new Date().getDate())) // calendrier = date du jour
  })
  it('Compte : affiche l\'initiale du joueur une fois connecté', async () => {
    const w = mount(App)
    expect(w.find('[data-test=nav-account] [data-test=initial]').exists()).toBe(false)
    user.value = { name: 'rudy', email: 'ini@b.fr', provider: 'local' }
    await w.vm.$nextTick()
    expect(w.find('[data-test=nav-account] [data-test=initial]').text()).toBe('R')
  })
})

describe('App : plus de vue cabine', () => {
  it('aucune fenêtre de cabine dans la page : le Trajet se regarde vu du dessus', async () => {
    localStorage.clear()
    logout()
    fakeServer()
    const w = mount(App, { attachTo: document.body })
    await flushPromises()
    expect(w.find('[data-test=cabin]').exists()).toBe(false)
    w.unmount()
  })
})
