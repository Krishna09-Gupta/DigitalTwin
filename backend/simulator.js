const { pool } = require('./src/config/db');

const INTERVAL_MS = 3000;

function nextValue(current, profile, metric) {
  const value = Number(current);
  const step = Number(profile.step);
  const min = Number(profile.min_value);
  const max = Number(profile.max_value);


  if (!Number.isFinite(value)) {
    return Number.isFinite(min) ? min : 0;
  }

  let next;

  // At minimum, force the value upward
  if (Number.isFinite(min) && value <= min) {
    next = value + step;

  // At maximum, force the value downward
  } else if (Number.isFinite(max) && value >= max) {
    next = value - step;

  // Otherwise randomly move up or down
  } else {
    const direction = Math.random() >= 0.5 ? 1 : -1;
    next = value + direction * step;
  }

  if (metric.metric_name === 'Habitat Oxygen Saturation') {
    next = value + (Math.random() - 0.5) * step;
  }

  if (Number.isFinite(min)) {
    next = Math.max(min, next);
  }

  if (Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  
  
  return Number(next.toFixed(2));
}

async function tick() {
  const result = await pool.query(`
    SELECT
      tm.id,
      tm.station_id,
      tm.metric_name,
      tm.current_value,
      tm.is_overridden,
      tm.min_value,
      tm.max_value,
      COALESCE(sp.step, GREATEST((tm.max_value - tm.min_value)*0.01,0.1)) AS step, 
      COALESCE(sp.min_value, tm.min_value) AS profile_min,
      COALESCE(sp.max_value, tm.max_value) AS profile_max
    FROM telemetry_metrics tm
    LEFT JOIN simulation_profiles sp
      ON sp.station_id = tm.station_id
      AND sp.metric_name = tm.metric_name
    WHERE tm.is_overridden = false
  `);

  for (const metric of result.rows) {
  
    const next = nextValue(
      metric.current_value,
      {
        step: metric.step,
        min_value: metric.profile_min,
        max_value: metric.profile_max
      },
      metric
    );
    
    

    const updated=await pool.query(
      `UPDATE telemetry_metrics
       SET current_value = $1,
           updated_at = NOW()
       WHERE id = $2
         AND is_overridden = false`,
      [next, metric.id]
    );

    await pool.query(
      `SELECT pg_notify('telemetry_update', $1)`,
      [
        JSON.stringify({
          stationId: metric.station_id,
          metricId: metric.id
        })
      ]
    );
  }
}

console.log('[SIMULATOR] Multi-station telemetry engine started.');

setInterval(() => {
  tick().catch((err) => console.error('[SIMULATOR]', err.message));
}, INTERVAL_MS);

tick().catch((err) => console.error('[SIMULATOR]', err.message));

