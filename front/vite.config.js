import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
    plugins: [vue()],
    server: {
        host: true,
        port: 5173,
        fs: { allow: ['..'] }, // le dossier shared/ (règles du jeu) est hors de front/
    },
});
