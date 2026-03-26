# GhostLink Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Build frontend (served by backend)
COPY frontend/dist/ ./frontend/dist/

# Data volume
VOLUME /app/backend/data

EXPOSE 8300 8200 8201

WORKDIR /app/backend
CMD ["python", "app.py"]
