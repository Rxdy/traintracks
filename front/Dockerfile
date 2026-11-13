# Contexte de build = racine du dépôt (le front importe le dossier shared/).
# --- Étape 1 : build de l'app Vue ---
FROM node:22-alpine AS build
WORKDIR /app/front

COPY front/package.json front/package-lock.json* ./
RUN npm install

COPY shared /app/shared
# Données des niveaux : lues par les TESTS seulement (vérification de types du build) ; absentes de l'image finale.
COPY server/data /app/server/data
COPY front ./
RUN npm run build

# --- Étape 2 : image finale légère (nginx alpine) ---
FROM nginx:1.27-alpine AS runtime
COPY front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/front/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
