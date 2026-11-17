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

.PHONY: bpmn
bpmn: ## Génère les diagrammes BPMN (bpmn/out)
	python3 bpmn/generate.py

.PHONY: test-server
test-server: ## Tests du serveur (PostgreSQL en mémoire)
	cd server && npm test

.PHONY: backup
backup: ## Sauvegarde la base dans backups/ (fichier .sql.gz horodaté)
	@mkdir -p backups
	$(COMPOSE) exec -T db pg_dump -U traintracks traintracks | gzip > backups/traintracks-$$(date +%F-%H%M).sql.gz
	@ls -1t backups | head -1

.PHONY: plan
plan: ## Affiche le plan du Voyage (tailles, règles, alternance) ; TO=300 pour changer la fin
	cd server && npx tsx src/plan.cli.ts $(or $(TO),300)

.PHONY: build-levels audit freeze pace add-levels
build-levels: ## Fabrique les niveaux du plan (server/data/levels.json) ; les niveaux gelés sont conservés
	cd server && npx tsx src/build.cli.ts $(TO)

audit: ## Compare les niveaux au plan, vérifie l'unicité et la montée de difficulté
	cd server && npx tsx src/audit.cli.ts

freeze: ## Gèle les niveaux actuels : protège les niveaux publiés (on peut toujours en AJOUTER à la suite, voir docs/niveaux.md)
	cd server && npx tsx src/freeze.cli.ts

add-levels: ## Publier de nouveaux niveaux : fabrique jusqu'à TO=N, audite, étend le gel (docs/niveaux.md)
	@test -n "$(TO)" || (echo "Usage : make add-levels TO=350" && exit 1)
	$(MAKE) build-levels TO=$(TO)
	$(MAKE) audit
	$(MAKE) freeze

pace: ## Temps de jeu RÉELS par niveau (base en cours), à comparer aux durées estimées du plan
	$(COMPOSE) exec -T api npx tsx src/pace.cli.ts

.PHONY: dev-player
dev-player: ## Compte d'essai arrivé à un niveau : make dev-player LEVEL=60 [COINS=200] (développement seulement)
	$(COMPOSE) exec -T -e DEV_TOOLS=1 api npx tsx src/devPlayer.cli.ts $(or $(LEVEL),1) $(COINS)

.PHONY: release
release: ## Publie une version : make release V=1.0.0 (tag vX.Y.Z sur main, déjà en prod ; la CI pose la version sur les images de la prod et crée la release)
	@test -f server/data/levels.lock.json || echo "Attention : niveaux non gelés (make freeze), sans importance tant qu'aucun joueur réel n'a joué."
	@.github/images/release.sh "$(V)"
