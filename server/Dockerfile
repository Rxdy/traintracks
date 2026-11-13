# Contexte de build = racine du dépôt (le serveur importe le dossier shared/).
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY shared /app/shared
COPY server/src ./src
COPY server/migrations ./migrations
COPY server/data ./data
USER node
EXPOSE 3000
CMD ["npx", "tsx", "src/main.ts"]
