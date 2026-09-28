FROM python:3.13-alpine

WORKDIR /app
COPY server.py index.html styles.css script.js ./
COPY public ./public
RUN mkdir -p /data && addgroup -S safety && adduser -S -G safety safety && chown -R safety:safety /data /app

USER safety
ENV PORT=8000 SAFETY_DB_PATH=/data/safety.db PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
