FROM python:3.12-alpine

RUN apk add --no-cache gcc musl-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY processor.py .

ENV SENTINEL_LOG_FILE=/var/log/perimeter/traffic.jsonl
ENV SENTINEL_DB_PATH=/data/sentinel.db
ENV SENTINEL_BATCH=50
ENV SENTINEL_POLL=0.5

CMD ["python", "-u", "processor.py"]
