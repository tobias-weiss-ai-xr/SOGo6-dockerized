FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Non-root
RUN useradd -m -u 10001 sogo
USER sogo

EXPOSE 9000

ENV SOGO_AGENT_API_URL=http://sogo6-server:5000/api/user/v1

CMD ["python", "server.py"]
