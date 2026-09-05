import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    request_pool: {
      executor: 'shared-iterations',

      // Number of simulated users
      vus: 10,

      // Total requests/iterations
      iterations: 10,

      maxDuration: '1m',
    },
  },
};

const BASE_URL = 'http://host.docker.internal:3000';

const products = [
  'P001',
  'P002',
  'P003',
  'P004',
  'P005',
];

export default function () {

  const product =
    products[Math.floor(Math.random() * products.length)];

  const response = http.get(
    `${BASE_URL}/api/products/${product}`
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}