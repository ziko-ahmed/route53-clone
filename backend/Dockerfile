FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The database file lives on a volume so it survives a redeploy.
ENV DATABASE_URL=sqlite:////data/route53.db
VOLUME ["/data"]

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
