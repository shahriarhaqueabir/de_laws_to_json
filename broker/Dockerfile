FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY broker.py .

EXPOSE 9000

CMD ["uvicorn", "broker:app", "--host", "0.0.0.0", "--port", "9000"]
