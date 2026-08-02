import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ─────────────────────────────────────────────
// CUSTOM METRICS
// ─────────────────────────────────────────────
const paymentSuccess = new Counter('payment_success');
const paymentFailed = new Counter('payment_failed');
const paymentErrorRate = new Rate('payment_error_rate');
const paymentDuration = new Trend('payment_duration_ms', true);

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
  scenarios: {
    payment_30s_benchmark: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
    },
  },
};

// ─────────────────────────────────────────────
// MAIN TEST
// ─────────────────────────────────────────────
export default function (data) {
  const token = data?.token || 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODU2NzkwMjgsImV4cCI6MTc4NTY4NjIyOH0.1O4D5T3j4mSAyyg1SROSGHQOy7Ty-s_vVNPQxVl4yvQ';
  const studentId = 1;
  const amount = Number((Math.random() * 990 + 10).toFixed(2));
  const reference = `PAY-${__VU}-${__ITER}-${Date.now()}`;

  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/api/payments`,
    JSON.stringify({
      student_id: studentId,
      amount,
      reference,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'keep-alive',
      },
      timeout: '10s',
    }
  );

  const duration = Date.now() - start;
  paymentDuration.add(duration);

  const success = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
  });

  if (success) {
    paymentSuccess.add(1);
    paymentErrorRate.add(false);
  } else {
    paymentFailed.add(1);
    paymentErrorRate.add(true);
  }
}

// ─────────────────────────────────────────────
// TEARDOWN
// ─────────────────────────────────────────────
export function teardown() {
  console.log('\n======================================');
  console.log(' BENCHMARK COMPLETE');
  console.log('======================================\n');
}
