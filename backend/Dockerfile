FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# No DATABASE_URL is set here on purpose.
#   - Left unset, the app falls back to a SQLite file inside the container.
#     That is fine locally, but it is wiped whenever the container restarts.
#   - In production, set DATABASE_URL to a managed Postgres connection string.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
