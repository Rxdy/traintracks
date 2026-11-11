COMPOSE = docker compose

.PHONY: up down build logs restart re clean

## Build + démarre le front en arrière-plan (http://localhost:8090)
up:
	$(COMPOSE) up -d --build

## Arrête et supprime les conteneurs
down:
	$(COMPOSE) down

## Build de l'image seulement
build:
	$(COMPOSE) build

## Suit les logs du front
logs:
	$(COMPOSE) logs -f front

## Redémarre les conteneurs
restart:
	$(COMPOSE) restart

## Down puis up (rebuild complet)
re: down up

## Down + supprime volumes et images orphelines
clean:
	$(COMPOSE) down --rmi local --volumes --remove-orphans
