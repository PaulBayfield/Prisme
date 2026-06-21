FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Dependencies first so they're cached separately from the (more frequently
# changing) source - --no-install-project skips this step's own package,
# which has no source to install yet.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project

COPY . .
RUN uv sync --locked

# Real credentials come from docker-compose's environment, not a baked-in
# .env (see .dockerignore) - __main__.py's load_dotenv() call is a no-op
# when the file isn't there.
CMD ["uv", "run", "python", "__main__.py"]
