import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from './pwa'
import { authErrorFromUrl, confirmEmailChangeFromUrl, confirmFromUrl, loadProviders, refreshSession, resetFromUrl, welcomeFromUrl } from './auth'
import './style.css'
import { blockZoom } from './noZoom'

createApp(App).mount('#app')
blockZoom()
registerSW()
void refreshSession()
void loadProviders()
authErrorFromUrl()
welcomeFromUrl()
void confirmFromUrl()
void confirmEmailChangeFromUrl()
resetFromUrl()
