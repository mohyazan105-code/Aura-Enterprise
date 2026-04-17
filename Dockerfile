FROM python:3.10-slim
WORKDIR /app
# تثبيت الأساسيات فقط أولاً
RUN pip install --no-cache-dir gunicorn flask flask-cors
# نسخ الملفات
COPY . .
# تثبيت باقي المتطلبات مع تجاهل الملفات الكبيرة إذا وجدت
RUN pip install --no-cache-dir -r requirements.txt
# ضبط البيئة لمنع استهلاك الذاكرة
ENV WEB_CONCURRENCY=1
ENV PORT=10000
# تشغيل عملية واحدة (Worker) وخيط واحد (Thread) فقط - هذا هو السر
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--workers", "1", "--threads", "1", "--worker-class", "sync", "--timeout", "120", "app:app"]
