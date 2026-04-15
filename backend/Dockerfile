FROM python:3.12-alpine

RUN apk add --no-cache gcc musl-dev libffi-dev

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Dashboard static files are mounted at runtime via Docker volume
# or copied here during image build in production

ENV SENTINEL_DB_PATH=/data/sentinel.db
ENV MAXMIND_DB_PATH=/mmdb/GeoLite2-Country.mmdb
ENV STATIC_DIR=/app/static

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
