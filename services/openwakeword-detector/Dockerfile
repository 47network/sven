FROM python:3.11-slim-bookworm@sha256:97b0eafb29f5ebfba254be840115b2f3bc24ff6ff3de9b905e04b74ee7227ba6 AS build

WORKDIR /app

COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

FROM python:3.11-slim-bookworm@sha256:97b0eafb29f5ebfba254be840115b2f3bc24ff6ff3de9b905e04b74ee7227ba6 AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
COPY --from=build /wheels /wheels
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY app.py /app/app.py
COPY models /opt/openwakeword-models
RUN mkdir -p /usr/local/lib/python3.11/site-packages/openwakeword/resources/models \
    && cp -R /opt/openwakeword-models/. /usr/local/lib/python3.11/site-packages/openwakeword/resources/models/

ENV PYTHONUNBUFFERED=1
ENV OPENWAKEWORD_PORT=4410

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "4410"]
