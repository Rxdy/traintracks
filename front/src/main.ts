import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from './pwa'
import { authErrorFromUrl, confirmEmailChangeFromUrl, confirmFromUrl, loadProviders, refreshSession, resetFromUrl } from './auth'
import './style.css'

createApp(App).mount('#app')
registerSW()
void refreshSession()
void loadProviders()
authErrorFromUrl()
void confirmFromUrl()
void confirmEmailChangeFromUrl()
resetFromUrl()
