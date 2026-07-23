import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // Ramp up to 10 virtual users over 30s
    { duration: "1m", target: 10 }, // Stay at 10 VUs for 1 minute
    { duration: "30s", target: 0 }, // Ramp down to 0 VUs
  ],
};

const BASE_URL = "http://localhost";
const TEST_EMAIL = "admin@gmail.com";
const TEST_PASSWORD = "123456";

export default function () {
  // 1. Login to get a token
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  check(loginRes, {
    "login succeeded": (r) => r.status === 200,
  });

  const token = loginRes.json("data.token");

  // 2. Get students list
  const studentsRes = http.get(`${BASE_URL}/api/student`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  check(studentsRes, {
    "students list retrieved": (r) => r.status === 200,
  });

  sleep(1);
}
