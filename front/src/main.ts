import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from './pwa'
import { authErrorFromUrl, confirmEmailChangeFromUrl, confirmFromUrl, loadProviders, refreshSession, resetFromUrl, welcomeFromUrl } from './auth'
import './style.css'
import { blockZoom } from './noZoom'

createApp(App).mount('#app')
blockZoom()
// Téléphone et tablette : le jeu se joue couché. L'appli installée démarre couchée (manifeste) ; là où le navigateur le permet
// (Android, appli installée ou plein écran), on verrouille aussi l'écran en paysage. Ailleurs, une page ne peut pas l'imposer.
if (window.matchMedia?.('(pointer: coarse)').matches) {
  const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
  o?.lock?.('landscape').catch(() => undefined)
}
registerSW()
void refreshSession()
void loadProviders()
authErrorFromUrl()
welcomeFromUrl()
void confirmFromUrl()
void confirmEmailChangeFromUrl()
resetFromUrl()
