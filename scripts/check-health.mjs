const base = String(process.argv[2] || process.env.ORBIT_HEALTH_URL || "http://127.0.0.1:4173/orbit").replace(/\/+$/, "");

async function checkProbe(probe) {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(`${base}/${probe}`, {
        headers: { "User-Agent": "orbit-healthcheck/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`${probe} failed with HTTP ${response.status}`);
      const body = await response.json();
      if (body.ok !== true) throw new Error(`${probe} returned an invalid payload`);
      return body.status;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

for (const probe of ["healthz", "readyz"]) {
  console.log(`${probe}: ${await checkProbe(probe)}`);
}
