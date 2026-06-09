FROM oven/bun:latest

WORKDIR /app

COPY package.json  /app/

RUN bun install

COPY . /app

EXPOSE 5173

CMD ["bun", "dev", "--host", ""]