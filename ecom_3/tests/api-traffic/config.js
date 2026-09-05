"use strict";

/**
 * CLI configuration for the ShopVerse CAAC traffic generator.
 * Hand-rolled parser — no external dependencies, matching the backend's
 * zero-dependency script convention (scripts/*.js).
 */

const PATTERNS = [
  "repeated",        // A — same resource over and over (frequency / hits)
  "hot-products",    // B — weighted skew toward a few products
  "cold",            // C — many distinct, low-frequency keys
  "mixed",           // D — 50% hot / 25% medium / 15% cold / 10% random
  "hit-test",        // E — sequential repeats, per-request latency table
  "query-variation", // F — search + categoryId query combinations
  "burst",           // G — timed baseline/peak traffic cycles
  "memory-pressure", // H — many distinct keys to force ADMIT/EVICT churn
];

const DEFAULTS = {
  baseUrl: process.env.SHOPVERSE_BASE_URL || "http://localhost:3000",
  pattern: "mixed",
  requests: null,        // explicit request count (else pattern default or rate*duration)
  duration: null,        // seconds; requests = rate * duration when both given
  rate: 5,               // starts per second (0 = as fast as possible)
  concurrency: 3,
  timeoutMs: 20000,  // recommendations/analytics take ~2-8s; keep a generous cap
  monitorInterval: 20,   // fetch /api/analytics/stats every N requests
  token: null,           // JWT for protected endpoints (recommendations, analytics)
  includeExpensive: false, // mix JWT-protected expensive endpoints when a token is available
  writeTest: false,      // allow safe writes (register a throwaway user)
  quiet: false,
  burstCycles: 2,
  burstPeakRate: 50,
  testCategoryId: false, // pattern F: exercise ?categoryId= (see README note)
};

const HELP = `ShopVerse CAAC API Traffic Generator

Usage:
  node traffic-generator.js --pattern <name> [options]

Patterns (A–H):
  repeated          Repeatedly GET the same resource -> frequency, cache hits
  hot-products      Skewed requests toward a few hot products (40/30/20/10%)
  cold              Many distinct keys, each touched once -> misses, rejections
  mixed             Realistic blend: 50% hot, 25% medium, 15% cold, 10% random
  hit-test          Same request N times; prints per-request latency + cache.hit
  query-variation   Search queries + categoryId variants (cache-key behavior)
  burst             Timed cycles: baseline rate -> peak rate -> baseline
  memory-pressure   Many distinct keys to force ADMIT/EVICT churn

Options:
  --pattern <name>        Pattern to run (default: mixed)
  --requests <n>          Total requests to generate (default per pattern)
  --duration <sec>        Run for <sec> seconds at --rate rps (requests = rate*duration)
  --rate <rps>            Request start rate, starts/sec (default: 5, 0 = fastest)
  --concurrency <n>       Max in-flight requests (default: 3)
  --base-url <url>        Backend base URL (default: http://localhost:3000)
  --timeout <ms>          Per-request timeout (default: 20000)
  --monitor-interval <n>  Print live analytics every N requests (default: 20)
  --token <jwt>           Bearer token for protected endpoints
  --include-expensive     Mix recommendations + product analytics (needs a token)
  --write-test            Allow safe writes: register a throwaway user for a token
  --burst-cycles <n>      Burst pattern: number of peak cycles (default: 2)
  --burst-peak-rate <rps> Burst pattern: peak rate (default: 50; note: backend
                          rate-limiter allows ~120 req/min per IP -> 429s expected)
  --test-category-id      Pattern F: also send ?categoryId= variants (see README)
  --quiet                 Suppress live progress lines
  --help                  Show this help

Examples:
  node traffic-generator.js --pattern repeated --requests 40
  node traffic-generator.js --pattern hot-products --requests 100 --rate 10
  node traffic-generator.js --pattern mixed --duration 120 --rate 10 --concurrency 5
  node traffic-generator.js --pattern burst --burst-cycles 3 --burst-peak-rate 40
  node traffic-generator.js --pattern memory-pressure --requests 200 --rate 15
  node traffic-generator.js --pattern hit-test --requests 12
`;

function parseArgs(argv) {
  const config = { ...DEFAULTS };
  const explicit = new Set(); // config keys the user explicitly set (override pattern defaults)
  const args = argv.slice(2);

  const set = (key, value) => {
    config[key] = value;
    explicit.add(key);
  };
  const setNum = (key) => (i, flag) => {
    const v = Number(take(i, flag));
    if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid number for ${flag}: ${args[i + 1]}`);
    set(key, v);
  };

  const take = (i, flag) => {
    if (i + 1 >= args.length) throw new Error(`Missing value for ${flag}`);
    return args[i + 1];
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const num = (flag) => {
      const v = Number(take(i, flag));
      if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid number for ${flag}: ${args[i + 1]}`);
      return v;
    };
    switch (arg) {
      case "--pattern": set("pattern", take(i, arg)); i++; break;
      case "--requests": setNum("requests")(i, arg); i++; break;
      case "--duration": setNum("duration")(i, arg); i++; break;
      case "--rate": setNum("rate")(i, arg); i++; break;
      case "--concurrency": setNum("concurrency")(i, arg); i++; break;
      case "--base-url": set("baseUrl", take(i, arg).replace(/\/+$/, "")); i++; break;
      case "--timeout": setNum("timeoutMs")(i, arg); i++; break;
      case "--monitor-interval": setNum("monitorInterval")(i, arg); i++; break;
      case "--token": set("token", take(i, arg)); i++; break;
      case "--include-expensive": set("includeExpensive", true); break;
      case "--write-test": set("writeTest", true); break;
      case "--burst-cycles": setNum("burstCycles")(i, arg); i++; break;
      case "--burst-peak-rate": setNum("burstPeakRate")(i, arg); i++; break;
      case "--test-category-id": set("testCategoryId", true); break;
      case "--quiet": set("quiet", true); break;
      case "--help":
      case "-h": console.log(HELP); process.exit(0);
      default: throw new Error(`Unknown option: ${arg} (see --help)`);
    }
  }

  config.__explicit = explicit;

  if (!PATTERNS.includes(config.pattern)) {
    throw new Error(`Unknown pattern "${config.pattern}". Valid: ${PATTERNS.join(", ")}`);
  }
  if (config.rate <= 0 && config.pattern !== "burst") {
    // rate 0 = as fast as possible (still capped by concurrency)
  }
  if (config.concurrency < 1) config.concurrency = 1;
  if (config.includeExpensive && !config.token && !config.writeTest) {
    console.warn("[warn] --include-expensive needs a token. Provide --token or --write-test (registers a throwaway user).");
  }
  return config;
}

module.exports = { parseArgs, DEFAULTS, PATTERNS, HELP };