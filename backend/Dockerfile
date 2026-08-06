FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*
RUN addgroup --system acme \
    && adduser --system --ingroup acme acme
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY docker-entrypoint.py /usr/local/bin/docker-entrypoint.py
RUN chown -R acme:acme /app
EXPOSE 8000
ENTRYPOINT ["python", "/usr/local/bin/docker-entrypoint.py"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "600", "--access-logfile", "-", "--error-logfile", "-"]
