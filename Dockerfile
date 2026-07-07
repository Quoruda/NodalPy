# Stage 1: Build React Frontend
FROM node:20 AS frontend-build
WORKDIR /app/front-editor

# Install dependencies
COPY front-editor/package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and plugins
COPY plugins/ /app/plugins/
RUN find /app/plugins -name "package.json" -execdir npm install --legacy-peer-deps \;
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

RUN pip install --no-cache-dir -r requirements.txt

# Structure the app directory to match the expected NodalPy build architecture
COPY back-api/ /app/
COPY plugins/ /app/plugins/
RUN find /app/plugins -name "requirements.txt" -exec pip install --no-cache-dir -r {} \;
COPY --from=frontend-build /app/front-editor/dist /app/front

# Persist user storage
VOLUME ["/app/storage"]

# Expose FastAPI port
EXPOSE 8000

# Server-side execution optimizations (adjust based on server power)
ENV NODAL_DEBOUNCE=300
ENV NODAL_BATCH_INTERVAL=50

# Run the FastAPI server via main.py
CMD ["python", "main.py"]
