import { cacheManager } from '../services/cache/manager.js';
import { runSimulation, SCENARIO_IDS } from '../services/cache/workload.js';

// Thin controllers for the cache control plane (/api/cache/*). All engine
// state lives in the cache manager singleton.

export function getStats(req, res, next) {
  try {
    res.json(cacheManager.snapshot());
  } catch (err) {
    next(err);
  }
}

export function getConfig(req, res, next) {
  try {
    res.json({ config: { ...cacheManager.config } });
  } catch (err) {
    next(err);
  }
}

export function updateConfig(req, res, next) {
  try {
    const config = cacheManager.updateConfig(req.body || {});
    res.json({ config, message: 'Cache config updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export function resetCache(req, res, next) {
  try {
    cacheManager.reset();
    res.json({ message: 'Cache reset', ...cacheManager.snapshot() });
  } catch (err) {
    next(err);
  }
}

export function getEvictions(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const events = cacheManager.events
      .filter((e) => ['evict', 'expire', 'reject', 'invalidate'].includes(e.reason))
      .slice(-limit)
      .reverse();
    res.json({ count: events.length, events });
  } catch (err) {
    next(err);
  }
}

export function streamEvents(req, res, next) {
  try {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(`event: hello\ndata: ${JSON.stringify({ type: 'hello', ...cacheManager.snapshot() })}\n\n`);

    const send = (payload) => {
      const eventName = payload.type === 'event' ? 'event' : payload.type;
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    cacheManager.subscribe(send);
    req.on('close', () => cacheManager.unsubscribe(send));
  } catch (err) {
    next(err);
  }
}

// POST /api/cache/simulate — runs the synthetic workload through every policy
// side by side and publishes the result over SSE for the dashboard.
export function simulate(req, res, next) {
  try {
    const { scenario, reqPerSec, durationSec, capacityMB } = req.body || {};
    const config = { ...cacheManager.config };
    if (capacityMB !== undefined) config.capacityMB = Number(capacityMB);

    const report = runSimulation({ scenario, reqPerSec, durationSec, config });
    cacheManager.lastSimulation = report;
    cacheManager.publish({ type: 'simulation', simulation: report });
    res.json({ simulation: report, scenarios: SCENARIO_IDS });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
