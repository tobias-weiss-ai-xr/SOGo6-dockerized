# Minimal Flask app for nubusintercom
FROM python:3.14-slim

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir flask flask-cors redis

# Copy app
COPY app.py .

# Expose port
EXPOSE 8100

# Run
CMD ["python", "app.py"]
