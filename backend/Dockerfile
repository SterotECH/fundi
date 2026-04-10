# backend/Dockerfile
FROM python:3.14-slim

# Don't write .pyc files, don't buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create non-root user — never run as root inside containers
RUN addgroup --system fundi && adduser --system --ingroup fundi fundi

WORKDIR /app

# Install system dependencies needed by psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Keep Docker's Poetry version aligned with the lockfile generator.
RUN pip install --no-cache-dir poetry==2.3.3

# Copy dependency files first — Docker layer caching means this layer
# only rebuilds when pyproject.toml or poetry.lock changes, not on every code change
COPY pyproject.toml poetry.lock* ./

# Install dependencies — no venv inside Docker, we're already isolated
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main --no-root

# Copy the rest of the code
COPY . .

# Switch to non-root user
USER fundi

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
