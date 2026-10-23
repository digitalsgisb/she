FROM python:3.13-alpine

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py cmms_bridge.py index.html styles.css script.js patrol.js patrol-default.json cmms-ui.js favicon.svg manifest.webmanifest sw.js ./
COPY public ./public
COPY she_statistics.py statistics-ui.js statistics.css ./
COPY air-leak-ui.js ./
COPY she_monitoring.py monitoring-ui.js monitoring.css ./
COPY access.py redtag.py redtag-ui.js redtag.css ./
COPY qrcodegen.py ./
COPY redtag-print.js ./
COPY reporting.py report.html reporting-ui.js reporting.css ./
COPY reporting_alerts.py reporting-alerts.js reporting-push-sw.js ./
RUN mkdir -p /data && addgroup -S safety && adduser -S -G safety safety && chown -R safety:safety /data /app

USER safety
ENV PORT=8000 SAFETY_DB_PATH=/data/safety.db PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python", "server.py"]
