import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from './pwa'
import { confirmFromUrl, refreshSession, resetFromUrl } from './auth'
import './style.css'

createApp(App).mount('#app')
registerSW()
void refreshSession()
void confirmFromUrl()
resetFromUrl()
