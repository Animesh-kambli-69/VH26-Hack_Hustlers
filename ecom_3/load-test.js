import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

export const options = {
  vus: 1000,
  iterations: 1000,
  maxDuration: '2m',
};

const hotProducts = [
  'P001',
  'P002',
  'P003',
];

const normalProducts = [
  'P004',
  'P005',
  'P006',
  'P007',
  'P008',
  'P009',
  'P010',
];

function getProduct() {
  if (Math.random() < 0.8) {
    return hotProducts[
      Math.floor(Math.random() * hotProducts.length)
    ];
  }

  return normalProducts[
    Math.floor(Math.random() * normalProducts.length)
  ];
}

export default function () {
  const product = getProduct();

  const response = http.get(
    `http://localhost:3000/api/products/${product}`
  );

  check(response, {
    'API returns 200': (r) => r.status === 200,
  });

  if (response.status === 200) {
    const body = JSON.parse(response.body);

    if (body.cache && body.cache.hit === true) {
      cacheHits.add(1);
    } else {
      cacheMisses.add(1);
    }
  }
}