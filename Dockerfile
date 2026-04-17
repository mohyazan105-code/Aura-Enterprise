FROM python:3.10-slim

WORKDIR /app

# نسخ ملف المتطلبات (تأكد أن اسمه requirements.txt كما يظهر في صورتك)
COPY requirements.txt .

# تثبيت المكتبات اللازمة
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي الملفات
COPY . .

# المنفذ الذي يعمل عليه Flask
EXPOSE 5000

# تشغيل السيرفر باستخدام Gunicorn للسرعة القصوى
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "2", "--timeout", "0", "app:app"]
