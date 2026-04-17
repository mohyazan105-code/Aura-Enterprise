FROM python:3.10-slim

WORKDIR /app

# نسخ ملف المتطلبات فقط أولاً لتسريع البناء
COPY requirements.txt .

# تثبيت الأساسيات فقط لتوفير الذاكرة
RUN pip install --no-cache-dir gunicorn flask flask-cors pandas scikit-learn

# نسخ باقي الملفات
COPY . .

# تشغيل بأقل استهلاك ممكن للموارد
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--workers", "1", "--threads", "1", "--timeout", "60", "app:app"]
