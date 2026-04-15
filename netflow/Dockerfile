FROM python:3.12-alpine

# No third-party dependencies — pure stdlib
WORKDIR /app
COPY collector.py .

ENV NETFLOW_HOST=0.0.0.0
ENV NETFLOW_PORT=2055
ENV SENTINEL_DB_PATH=/data/sentinel.db
ENV SENTINEL_BATCH=50

# UDP 2055 — standard NetFlow / IPFIX port
EXPOSE 2055/udp

CMD ["python", "-u", "collector.py"]
