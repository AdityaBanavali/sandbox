const API_BASE = '/api';

export async function fetchVisualizedGraph({ code, language, mode, apiKey, provider }) {
  const payload = {
    code,
    language: language || 'python',
    mode: mode || 'architecture',
    api_key: apiKey || null,
    provider: provider || 'gemini',
  };

  const response = await fetch(`${API_BASE}/visualize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error: ${response.statusText}`);
  }

  return await response.json();
}

export async function fetchSamples() {
  const response = await fetch(`${API_BASE}/samples`);
  if (!response.ok) {
    throw new Error('Failed to load sample snippets');
  }
  return await response.json();
}

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
