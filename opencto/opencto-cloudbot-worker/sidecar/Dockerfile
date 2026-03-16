FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

EXPOSE 8788

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8788"]
