# Variables
STACK_NAME=my-microservice-stack
COMPOSE_FILE=docker-compose.yml
PROD_COMPOSE_FILE=docker-compose.production.yml

.PHONY: help build-all proto-gen deploy-dev deploy-prod stop-dev stop-prod clean

help:
	@echo "Usage:"
	@echo "  make proto-gen    - Generate all proto files (Python & TS)"
	@echo "  make build-all    - Build all docker images locally"
	@echo "  make seed         - Seed the databases with demo data"
	@echo "  make deploy-dev   - Run the stack in development mode (Docker Compose)"
	@echo "  make stop-dev     - Stop the development stack"
	@echo "  make deploy-prod  - Deploy the stack to Docker Swarm"
	@echo "  make stop-prod    - Remove the stack from Docker Swarm"
	@echo "  make clean        - Remove build artifacts and temporary files"

# 1. Generate Proto Files
proto-gen:
	@echo "Generating proto files..."
	./api/scripts/proto-gen.sh

# 2. Build All Images
build-all:
	@echo "Building all images for production..."
	docker-compose -f $(PROD_COMPOSE_FILE) build

seed:
	@echo "Seeding Student Service..."
	cd api/services/student && uv run python seed.py
	@echo "Auth Service users are pre-seeded in memory."

# 3. Development Commands
dev: proto-gen
	@echo "Deploying in development mode..."
	docker-compose -f $(COMPOSE_FILE) up --build -d

stop-dev:
	@echo "Stopping development mode..."
	docker-compose -f $(COMPOSE_FILE) down

# 4. Production Commands (Swarm)
deploy: proto-gen build-all
	@echo "Deploying to Docker Swarm..."
	# Note: In a real prod env, you would also 'docker push' images to a registry here
	docker stack deploy -c $(PROD_COMPOSE_FILE) $(STACK_NAME)

stop-prod:
	@echo "Removing stack from Docker Swarm..."
	docker stack rm $(STACK_NAME)
