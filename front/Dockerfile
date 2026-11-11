# --- Étape 1 : build de l'app Vue ---
FROM node:22-alpine AS build
WORKDIR /app

# Installe les dépendances (cache Docker sur package.json)
COPY package.json package-lock.json* ./
RUN npm install

# Build de production
COPY . .
RUN npm run build

# --- Étape 2 : image finale légère (nginx alpine) ---
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
