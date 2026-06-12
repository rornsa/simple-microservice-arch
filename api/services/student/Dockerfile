FROM python:3.11-slim

# Install dependencies for uv
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install uv
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:$PATH"

WORKDIR /app

# Copy lock files for caching dependencies
COPY pyproject.toml uv.lock /app/

# Sync dependencies only, using cache
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project

# Copy the rest of the project
COPY . /app

# Final sync (project + dependencies)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked

CMD ["uv", "run", "fastapi", "run", "main.py", "--port", "8000", "--host", "0.0.0.0"]