import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import SettingsView from './views/SettingsView.vue'
import { reducedMotion, reducedPref, volumes } from './settings'
import { speed } from './speedPref'
import { soundOn } from './sound/director'

enableAutoUnmount(afterEach)
afterEach(() => {
  volumes.value = { music: 1, sfx: 1, train: 1, amb: 1 }
  reducedPref.value = false
})

describe('Paramètres', () => {
  it('les 7 réglages : son, 4 volumes, vitesse du train, animations', () => {
    const w = mount(SettingsView)
    expect(w.find('[data-test=set-sound]').exists()).toBe(true)
    for (const k of ['music', 'sfx', 'train', 'amb']) expect(w.find(`[data-test=set-${k}]`).exists()).toBe(true)
    expect(w.findAll('[data-test^=set-speed-]')).toHaveLength(3)
    expect(w.find('[data-test=set-anim-reduced]').exists()).toBe(true)
  })

  it('un volume, la vitesse et les animations se règlent et sont gardés dans l\'appareil', async () => {
    const w = mount(SettingsView)
    const music = w.find('[data-test=set-music]')
    ;(music.element as HTMLInputElement).value = '40'
    await music.trigger('input')
    expect(volumes.value.music).toBeCloseTo(0.4)
    await w.find('[data-test=set-speed-fast]').trigger('click')
    expect(speed.value).toBe('fast')
    await w.find('[data-test=set-anim-reduced]').trigger('click')
    expect(reducedPref.value).toBe(true)
    expect(reducedMotion()).toBe(true)
    await w.vm.$nextTick()
    expect(JSON.parse(localStorage.getItem('traintracks.parametres')!)).toMatchObject({ volumes: { music: 0.4 }, reduced: true })
  })

  it('couper le son ici coupe le son du jeu', async () => {
    const before = soundOn.value
    const w = mount(SettingsView)
    const box = w.find('[data-test=set-sound]')
    await box.setValue(!before)
    expect(soundOn.value).toBe(!before)
    await box.setValue(before)
  })
})
