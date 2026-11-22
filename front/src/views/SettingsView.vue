<script setup lang="ts">
import { computed } from 'vue'
import { reducedPref, volumes, type Volumes } from '../settings'
import { sound, soundOn } from '../sound/director'
import { speed } from '../speedPref'
import type { Speed } from '../components/SpeedControl.vue'

// Paramètres (l'engrenage de l'accueil) : le son et le jeu. Tout est gardé dans cet appareil.
const SLIDERS: { key: keyof Volumes; label: string; hint: string }[] = [
  { key: 'music', label: 'Musique des menus', hint: 'accueil, classement, compte' },
  { key: 'sfx', label: 'Effets du jeu', hint: 'pose des rails, pièces' },
  { key: 'train', label: 'Train', hint: 'rails, moteur, cloche' },
  { key: 'amb', label: 'Ambiance du décor', hint: 'eau, vent, animaux' },
]
const SPEEDS: { id: Speed; label: string }[] = [
  { id: 'slow', label: 'Lent' },
  { id: 'normal', label: 'Normal' },
  { id: 'fast', label: 'Rapide' },
]
const pct = (k: keyof Volumes) => Math.round(volumes.value[k] * 100)
function setVol(k: keyof Volumes, e: Event): void {
  volumes.value = { ...volumes.value, [k]: Number((e.target as HTMLInputElement).value) / 100 }
}
const on = computed({ get: () => soundOn.value, set: (v: boolean) => sound.setOn(v) })
</script>

<template>
  <section class="settings" data-test="settings">
    <div class="col card">
      <h2>Son</h2>
      <label class="row toggle">
        <span>Son du jeu</span>
        <input v-model="on" type="checkbox" data-test="set-sound" />
      </label>
      <label v-for="s in SLIDERS" :key="s.key" class="row slider" :class="{ dim: !on }">
        <span><strong>{{ s.label }}</strong><small>{{ s.hint }}</small></span>
        <input type="range" min="0" max="100" step="5" :value="pct(s.key)" :aria-label="s.label" :data-test="'set-' + s.key" @input="setVol(s.key, $event)" />
        <b class="val">{{ pct(s.key) }}</b>
      </label>
    </div>

    <div class="col card">
      <h2>Jeu</h2>
      <div class="row choice">
        <span><strong>Vitesse du train</strong><small>au départ du Trajet</small></span>
        <div class="seg" role="group" aria-label="Vitesse du train">
          <button v-for="o in SPEEDS" :key="o.id" type="button" :aria-pressed="speed === o.id" :class="{ on: speed === o.id }" :data-test="'set-speed-' + o.id" @click="speed = o.id">{{ o.label }}</button>
        </div>
      </div>
      <div class="row choice">
        <span><strong>Animations</strong><small>réduites : moins de mouvement, sans ombres</small></span>
        <div class="seg" role="group" aria-label="Animations">
          <button type="button" :aria-pressed="!reducedPref" :class="{ on: !reducedPref }" data-test="set-anim-normal" @click="reducedPref = false">Normales</button>
          <button type="button" :aria-pressed="reducedPref" :class="{ on: reducedPref }" data-test="set-anim-reduced" @click="reducedPref = true">Réduites</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 0.9rem;
}
.card {
  border-radius: 1.2rem;
  border: 3px solid #fff;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 3px 10px rgba(30, 64, 175, 0.15);
  padding: 0.9rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
h2 {
  margin: 0;
  font-size: 1.1rem;
}
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.row > span {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.row small {
  color: #4b5563;
  font-size: 0.8rem;
}
.toggle {
  font-weight: 700;
}
.toggle input {
  width: 1.4rem;
  height: 1.4rem;
  accent-color: #16a34a;
}
.slider input {
  width: min(11rem, 40vw);
  accent-color: #2563eb;
}
.slider.dim {
  opacity: 0.5;
}
.val {
  width: 2.2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.seg {
  display: flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border-radius: 999px;
  background: #eef2f7;
}
.seg button {
  border: 0;
  border-radius: 999px;
  padding: 0.4rem 0.85rem;
  background: transparent;
  color: #4b5563;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.seg button.on {
  background: #f59e0b;
  color: #3b2400;
  font-weight: 800;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
</style>
