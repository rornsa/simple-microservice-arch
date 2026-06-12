FROM oven/bun:latest

WORKDIR /app

# install ps command
RUN apt-get update && apt-get install -y procps

RUN bun add -g @nestjs/cli

COPY package*.json ./
RUN bun install

COPY . .

RUN bun run build