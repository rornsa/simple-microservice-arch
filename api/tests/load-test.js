import http from 'k6/http';
import { abort, check } from 'k6';
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
const BASE_URL = __ENV.BASE_URL || 'http://172.20.10.4';

export const options = {
  thresholds: {
    http_req_failed: ['rate==0'],
  },
  scenarios: {
    concurrency_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 100 },
        { duration: '1m', target: 500 },
      ],
    },
  },
};

export function handleSummary(data) {
  console.log('Test finished. Last observed RPS:', data.metrics.http_reqs.rate);
  return {};
}


// ─────────────────────────────────────────────
// REQUEST PARAMS
// ─────────────────────────────────────────────
const PARAMS = {
  headers: {
    'Content-Type': 'application/json',
    Connection: 'keep-alive',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODEyNzIyMjIsImV4cCI6MTc4MTI3OTQyMn0.89TLafQUHip1eHUH86TyQ7I80nmvchDuOOFy33-KXOk'
  },
  timeout: '10s',
};

// ─────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────
export function setup() {
  console.log('');
  console.log('======================================');
  console.log(' PAYMENT TEST (100 requests / 30 sec)');
  console.log('======================================');
  console.log(`Target: ${BASE_URL}`);
  console.log('');

  const studentIds = [];

  for (let i = 1; i <= 10; i++) {
    const res = http.post(
      `${BASE_URL}/api/student`,
      JSON.stringify({
        firstName: 'LoadTest',
        lastName: `User${i}`,
        email: `loadtest${Date.now()}_${i}@test.com`,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3ODEyNzIyMjIsImV4cCI6MTc4MTI3OTQyMn0.89TLafQUHip1eHUH86TyQ7I80nmvchDuOOFy33-KXOk'  
        },
      }
    );

    if (res.status === 200 || res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        const id = body?.data?.id ?? body?.id;

        if (id) {
          studentIds.push(Number(id));
        }
      } catch (_) {}
    }
  }

  console.log(`Using ${studentIds.length} students`);
  console.log('');

  return {
    studentIds:
      studentIds.length > 0
        ? studentIds
        : [1, 2, 3, 4, 5],
  };
}

// ─────────────────────────────────────────────
// MAIN TEST
// ─────────────────────────────────────────────
export default function (data) {
  const ids = data.studentIds;

  const studentId =
    ids[Math.floor(Math.random() * ids.length)];

  const amount = Number(
    (Math.random() * 990 + 10).toFixed(2)
  );

  const reference = `PAY-${__VU}-${__ITER}-${Date.now()}`;

  const start = Date.now();

  const res = http.post(
    `${BASE_URL}/api/student/${studentId}/pay`,
    JSON.stringify({
      amount,
      reference,
    }),
    PARAMS,
  );

  const duration = Date.now() - start;

  paymentDuration.add(duration);

  const success = check(res, {
    'status is 200 or 201': (r) =>
      r.status === 200 || r.status === 201,
  });

  if (success) {
    paymentSuccess.add(1);
    paymentErrorRate.add(false);
  } else {
    paymentFailed.add(1);
    paymentErrorRate.add(true);

    console.error(
      `FAIL status=${res.status} duration=${duration}ms`
    );
    abort();
  }
}

// ─────────────────────────────────────────────
// TEARDOWN
// ─────────────────────────────────────────────
export function teardown() {
  console.log('');
  console.log('======================================');
  console.log(' TEST COMPLETE');
  console.log('======================================');
  console.log('');
  console.log('Expected requests: ~100');
  console.log('Duration: 30 seconds');
  console.log('');
  console.log('RabbitMQ UI: http://localhost:15672');
  console.log('Username: user');
  console.log('Password: password');
  console.log('');
}