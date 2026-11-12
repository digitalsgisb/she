FROM python:3.13-alpine

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY web ./web
RUN mkdir -p /data && addgroup -S safety && adduser -S -G safety safety && chown -R safety:safety /data /app

USER safety
ENV PORT=8000 SAFETY_DB_PATH=/data/safety.db PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "backend/server.py"]
