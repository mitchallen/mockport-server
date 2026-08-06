# Front door for building, testing and running mockport-server.
#
# Everything here is overridable, e.g.:
#
#     make run HOST_PORT=8080
#     make run MOUNT=            # serve the image's built-in data/mock.json
#     make start MOCKFILE=./data/animal.json
#
# Kept compatible with GNU Make 3.81, the version macOS ships, so no
# .ONESHELL and no 4.x-only functions.

IMAGE           ?= mitchallen/mockport-server
TAG             ?= latest
CONTAINER       ?= mockport-server
SMOKE_CONTAINER ?= mockport-smoke

# Port inside the container. Matches EXPOSE in the Dockerfile and the
# default in src/index.js.
PORT       ?= 1234
HOST_PORT  ?= 7777
SMOKE_PORT ?= 7788

# Host directory mounted over /usr/src/app/data. Set MOUNT= (empty) to
# leave the image's built-in mockfile in place.
MOUNT ?= $(PWD)/test/data

ifeq ($(strip $(MOUNT)),)
VOLUME_ARG :=
SMOKE_PATH := /pets/1
else
VOLUME_ARG := -v $(MOUNT):/usr/src/app/data
SMOKE_PATH := /dogs/1
endif

# Path the smoke test curls. The built-in mockfile serves /pets/*, the one
# under test/data serves /dogs/*, so the path follows whichever is mounted.

.DEFAULT_GOAL := help

# Version increment `make release` applies when VERSION is not given.
BUMP ?= patch

.PHONY: help install test coverage audit check start start-animal \
        build run logs shell stop rm restart ps smoke ci release tag \
        clean distclean

help: ## Show this help
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- node ---

# Stamped on node_modules itself: npm ci rewrites the directory, so its
# mtime is newer than the lockfile afterwards and this stays up to date.
node_modules: package-lock.json package.json
	npm ci
	@touch node_modules

install: node_modules ## Install dependencies from the lockfile

test: node_modules ## Run the unit tests
	npm test

coverage: node_modules ## Run the unit tests with coverage
	npm run test:coverage

audit: node_modules ## Fail on known vulnerabilities, as CI does
	npm audit --audit-level=moderate

check: test audit ## Run the tests and the audit

start: node_modules ## Run the server locally (MOCKFILE=... to override)
ifeq ($(strip $(MOCKFILE)),)
	npm start
else
	MOCKFILE=$(MOCKFILE) PORT=$(PORT) node src/index.js
endif

start-animal: node_modules ## Run the server locally against data/animal.json
	npm run start:animal

# -------------------------------------------------------------- docker ---

build: ## Build the docker image
	docker build -t $(IMAGE):$(TAG) .

run: build ## Run the image detached on HOST_PORT
	docker run -d -p $(HOST_PORT):$(PORT) $(VOLUME_ARG) \
	  --name $(CONTAINER) $(IMAGE):$(TAG)
	@echo "listening on http://localhost:$(HOST_PORT)$(SMOKE_PATH)"

logs: ## Follow the container's console output
	docker logs -f $(CONTAINER)

shell: ## Open a shell in the running container
	docker exec -it $(CONTAINER) sh

stop: ## Stop the container
	docker stop $(CONTAINER)

rm: ## Stop and remove the container
	-docker rm -f $(CONTAINER)

restart: rm run ## Recreate the container from the current image

ps: ## Show the container's status
	docker ps -a -f name=$(CONTAINER)

# Mirrors the docker job in .github/workflows/ci.yml: prove the image
# actually serves a mock before trusting it. Uses its own container name
# and port so it never disturbs a container left running by `make run`.
smoke: build ## Build the image and verify it serves a mock
	@docker rm -f $(SMOKE_CONTAINER) >/dev/null 2>&1 || true
	@docker run -d -p $(SMOKE_PORT):$(PORT) $(VOLUME_ARG) \
	  --name $(SMOKE_CONTAINER) $(IMAGE):$(TAG) >/dev/null
	@ok=0; \
	for i in $$(seq 1 30); do \
	  if curl -sf -o /dev/null http://localhost:$(SMOKE_PORT)$(SMOKE_PATH); then \
	    ok=1; break; \
	  fi; \
	  sleep 1; \
	done; \
	if [ "$$ok" = "1" ]; then \
	  code=$$(curl -s -o /dev/null -w '%{http_code}' \
	    http://localhost:$(SMOKE_PORT)$(SMOKE_PATH)); \
	else \
	  code=""; \
	fi; \
	if [ "$$code" != "200" ]; then \
	  echo "smoke test failed (got '$$code' for $(SMOKE_PATH))"; \
	  docker logs $(SMOKE_CONTAINER); \
	  docker rm -f $(SMOKE_CONTAINER) >/dev/null 2>&1 || true; \
	  exit 1; \
	fi; \
	docker rm -f $(SMOKE_CONTAINER) >/dev/null 2>&1 || true; \
	echo "smoke test passed ($(SMOKE_PATH) -> 200)"

ci: check smoke ## Everything CI runs, locally

# ------------------------------------------------------------- release ---

# Step one of a release: get the version bump onto main through a PR, so CI
# verifies it like any other change. Needs the gh CLI.
release: ## Open a release PR bumping the version (BUMP=patch|minor|major)
	@test -z "$$(git status --porcelain)" || \
	  { echo "working tree is dirty - commit or stash first"; exit 1; }
	@b=$$(git rev-parse --abbrev-ref HEAD); \
	if [ "$$b" != "main" ]; then \
	  echo "release starts from main (currently on $$b)"; exit 1; \
	fi
	git pull --ff-only origin main
	@new=$$(npm version $(if $(VERSION),$(VERSION),$(BUMP)) --no-git-tag-version); \
	v=$${new#v}; \
	git checkout -b release-$$v && \
	git add package.json package-lock.json && \
	git commit -q -m "Release $$new" && \
	git push -q -u origin release-$$v && \
	gh pr create --base main --title "Release $$new" \
	  --body "Bumps the version to $$v so a $$new tag can be cut. \`make tag\` refuses to tag unless package.json already matches, so this lands first." && \
	echo "" && \
	echo "Once the PR merges:" && \
	echo "  git checkout main && git pull" && \
	echo "  make tag VERSION=$$v" && \
	echo "  git push origin $$new"

# Step two. Does not push: pushing the tag is what triggers the publish
# workflow, so that stays a deliberate, separate step.
tag: ## Tag a release locally (VERSION=x.y.z, must match package.json)
	@test -n "$(VERSION)" || { echo "usage: make tag VERSION=x.y.z"; exit 1; }
	@pkg=$$(node -p "require('./package.json').version"); \
	if [ "$$pkg" != "$(VERSION)" ]; then \
	  echo "VERSION=$(VERSION) does not match package.json version $$pkg."; \
	  echo "Bump package.json first, or run: make tag VERSION=$$pkg"; \
	  exit 1; \
	fi
	git tag v$(VERSION)
	@echo "Tagged v$(VERSION). Publish it with:  git push origin v$(VERSION)"

# --------------------------------------------------------------- clean ---

clean: ## Remove test and coverage output
	rm -rf coverage .nyc_output

distclean: clean ## Also remove node_modules and the built image
	rm -rf node_modules
	-docker rmi $(IMAGE):$(TAG)
