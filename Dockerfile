# Stage 1: Build React frontend
FROM node:20-slim AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Python backend + serve built frontend
FROM python:3.12-slim
WORKDIR /app

# Install Python dependencies
COPY server/requirements.txt ./server/
RUN pip install --no-cache-dir -r server/requirements.txt

# Copy backend source
COPY server/ ./server/
COPY alembic.ini ./

# Copy built frontend from stage 1
COPY --from=frontend /app/client/dist ./client/dist

EXPOSE 8000
CMD uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8000}
