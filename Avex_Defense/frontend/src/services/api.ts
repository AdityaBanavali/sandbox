const API_BASE = 'http://localhost:8000/api/v1';

export async function fetchHealthMetrics() {
  try {
    const res = await fetch(`${API_BASE}/health/metrics`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.debug('Could not fetch backend health metrics (backend may be offline):', err);
    return null;
  }
}

export async function fetchAlertStatsSummary() {
  try {
    const res = await fetch(`${API_BASE}/alerts/stats/summary`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchRecentAlerts(limit = 25) {
  try {
    const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function updateAlertTriage(alertId: string, status: string) {
  try {
    const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function verifyAuditChain() {
  try {
    const res = await fetch(`${API_BASE}/audit/verify-all`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}
