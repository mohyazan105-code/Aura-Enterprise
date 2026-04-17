"""
Action Aura — Performance Monitoring API
Tracks request timing, slow queries, and system health.
"""
from flask import Blueprint, request, jsonify, g
from api.auth import login_required, role_required
from collections import deque
import time
import threading

perf_bp = Blueprint('performance', __name__)

# ─── In-memory metrics store ────────────────────────────────────────────────
_lock    = threading.Lock()
_metrics = deque(maxlen=500)   # rolling window of last 500 requests
_slow_q  = deque(maxlen=50)    # last 50 slow operations (>400ms)
_cache   = {}                  # simple TTL response cache
SLOW_THRESHOLD_MS = 400


def record_request(endpoint: str, method: str, status: int, duration_ms: float):
    """Called by middleware after every request."""
    entry = {
        "endpoint":    endpoint,
        "method":      method,
        "status":      status,
        "duration_ms": round(duration_ms, 2),
        "ts":          time.time(),
    }
    with _lock:
        _metrics.append(entry)
        if duration_ms > SLOW_THRESHOLD_MS:
            _slow_q.append(entry)


# ─── Response Cache Helper ───────────────────────────────────────────────────
def get_cached(key: str, ttl: int = 30):
    """Return cached value if not expired, else None."""
    if key in _cache:
        val, exp = _cache[key]
        if time.time() < exp:
            return val
        del _cache[key]
    return None


def set_cache(key: str, value, ttl: int = 30):
    """Store value in cache with TTL (seconds)."""
    _cache[key] = (value, time.time() + ttl)


def clear_cache(prefix: str = None):
    """Clear all cache entries, or those matching prefix."""
    with _lock:
        if prefix:
            for k in [k for k in _cache if k.startswith(prefix)]:
                del _cache[k]
        else:
            _cache.clear()


# ─── Middleware (called from app.py before/after request) ────────────────────
def before_request_hook():
    g._req_start = time.perf_counter()


def after_request_hook(response):
    start = getattr(g, '_req_start', None)
    if start:
        duration_ms = (time.perf_counter() - start) * 1000
        record_request(
            endpoint=request.path,
            method=request.method,
            status=response.status_code,
            duration_ms=duration_ms,
        )
    return response


# ─── API Endpoints ────────────────────────────────────────────────────────────

@perf_bp.route('/api/performance/metrics', methods=['GET'])
@login_required
@role_required('admin', 'manager')
def metrics():
    """Return rolling window metrics summary."""
    with _lock:
        all_m = list(_metrics)
        slow  = list(_slow_q)

    if not all_m:
        return jsonify({
            'summary': {'avg_ms': 0, 'p95_ms': 0, 'req_count': 0, 'error_rate': 0},
            'slow_requests': [],
            'hottest_endpoints': [],
            'recent': []
        })

    durations  = [m['duration_ms'] for m in all_m]
    errors     = [m for m in all_m if m['status'] >= 400]
    sorted_dur = sorted(durations)
    p95_idx    = int(len(sorted_dur) * 0.95)
    avg_ms     = sum(durations) / len(durations)
    p95_ms     = sorted_dur[min(p95_idx, len(sorted_dur) - 1)]
    error_rate = len(errors) / len(all_m) * 100

    # Hottest endpoints by avg latency
    ep_times = {}
    ep_counts = {}
    for m in all_m:
        ep = m['endpoint']
        ep_times[ep]  = ep_times.get(ep, 0) + m['duration_ms']
        ep_counts[ep] = ep_counts.get(ep, 0) + 1

    hottest = sorted(
        [{'endpoint': k, 'avg_ms': round(ep_times[k] / ep_counts[k], 1), 'count': ep_counts[k]}
         for k in ep_times],
        key=lambda x: x['avg_ms'], reverse=True
    )[:10]

    return jsonify({
        'summary': {
            'avg_ms':     round(avg_ms, 1),
            'p95_ms':     round(p95_ms, 1),
            'req_count':  len(all_m),
            'error_rate': round(error_rate, 1),
        },
        'slow_requests':    list(reversed(slow))[:20],
        'hottest_endpoints': hottest,
        'recent':           list(reversed(all_m))[:30],
    })


@perf_bp.route('/api/performance/health', methods=['GET'])
def health():
    """Public health check for uptime monitoring."""
    with _lock:
        count = len(_metrics)
        slow_count = len(_slow_q)
    return jsonify({
        'status': 'ok',
        'requests_tracked': count,
        'slow_requests': slow_count,
        'cache_keys': len(_cache),
        'ts': time.time()
    })


@perf_bp.route('/api/performance/cache/clear', methods=['POST'])
@login_required
@role_required('admin')
def clear_cache_ep():
    """Admin: clear response cache."""
    data = request.get_json() or {}
    prefix = data.get('prefix')
    clear_cache(prefix)
    return jsonify({'success': True, 'message': 'Cache cleared.'})
