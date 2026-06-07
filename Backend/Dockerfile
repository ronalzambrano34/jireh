FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./Backend/requirements.txt
RUN pip install --no-cache-dir -r Backend/requirements.txt

COPY . ./Backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "Backend.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
