FROM oven/bun:latest

WORKDIR /app

COPY package.json .

RUN bun install

COPY . .

EXPOSE 8001

CMD [ "bun", "run", "start" ]
