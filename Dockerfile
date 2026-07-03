# Stage 1: Build React Frontend
FROM node:20 AS frontend-build
WORKDIR /app/front-editor

# Install dependencies
COPY front-editor/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY front-editor/ ./

ARG VITE_WS_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Stage 2: Python Backend
FROM python:3.11-slim
WORKDIR /app

# System dependencies for scientific packages (pandas, numpy, etc.)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY back-api/requirements.txt .

# For a headless server, we don't need pywebview and its heavy Qt dependencies.
# We filter it out to make the Docker image much lighter.
RUN grep -v "pywebview" requirements.txt > req-server.txt && \
    pip install --no-cache-dir -r req-server.txt

# Structure the app directory to match the expected NodalPy build architecture
COPY back-api/ /app/
COPY --from=frontend-build /app/front-editor/dist /app/front

# Persist user storage
VOLUME ["/app/storage"]

# Expose FastAPI port
EXPOSE 8000

# Server-side execution optimizations (adjust based on server power)
ENV NODAL_DEBOUNCE=300
ENV NODAL_BATCH_INTERVAL=50

# Run FastAPI directly via Uvicorn (bypassing main.py and pywebview)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
