import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    gradual_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '20s', target: 10 },
        { duration: '20s', target: 30 },
        { duration: '20s', target: 60 },
        { duration: '20s', target: 100 },
        { duration: '10s', target: 0 },
      ],
    },
  },
};

const url = 'https://replacing-bracelets-situations-discrimination.trycloudflare.com/api/v1/flights/M175-M176-M177/photos?page=18&size=50';

export default function () {
  const params = {
    headers: {
      // Agar kerak bo‘lsa:
      // Authorization: 'Bearer TOKEN',
      // Cookie: 'session=...',
      // 'x-api-key': '...'
    },
  };

  const res = http.get(url, params);

  check(res, {
    'status ok': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}