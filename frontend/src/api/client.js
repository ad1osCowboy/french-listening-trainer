/**
 * API client for the French Listening Trainer backend.
 *
 * Set EXPO_PUBLIC_API_BASE_URL to point at your Render backend, e.g.:
 *   EXPO_PUBLIC_API_BASE_URL=https://french-trainer.onrender.com
 *
 * When unset, auto-detects the dev machine IP from Expo's manifest
 * so the physical device can reach a locally-running FastAPI backend.
 */

import Constants from 'expo-constants';

// ── Resolve the backend base URL ──────────────────────────────────
// Priority: explicit env var → auto-detect from Expo → localhost fallback

const FALLBACK_HOST = '192.168.28.100';
const BACKEND_PORT = 8000;

function resolveHost() {
  try {
    const expUrl = Constants.experienceUrl;
    if (expUrl) {
      const hostname = new URL(expUrl).hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return hostname;
      }
    }
  } catch (_) {
    // URL parsing failed
  }
  return FALLBACK_HOST;
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  `http://${resolveHost()}:${BACKEND_PORT}`;

console.log('API URL:', BASE_URL);

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  // Don't set Content-Type for FormData (browser/RN sets it with boundary)
  if (options.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // ── Sessions ──────────────────────────────────────────────────
  createSession: (data) =>
    request('/api/sessions/', { method: 'POST', body: JSON.stringify(data) }),

  listSessions: () =>
    request('/api/sessions/'),

  getSession: (id) =>
    request(`/api/sessions/${id}`),

  deleteSession: (id) =>
    request(`/api/sessions/${id}`, { method: 'DELETE' }),

  uploadAudio: async (sessionId, fileUri, fileName) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'audio/mpeg',
      name: fileName || 'recording.mp3',
    });
    return request(`/api/sessions/${sessionId}/upload-audio`, {
      method: 'POST',
      body: formData,
    });
  },

  // ── Segments ──────────────────────────────────────────────────
  createSegment: (sessionId, data) =>
    request(`/api/sessions/${sessionId}/segments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listSegments: (sessionId) =>
    request(`/api/sessions/${sessionId}/segments`),

  getSegment: (id) =>
    request(`/api/segments/${id}`),

  deleteSegment: (id) =>
    request(`/api/segments/${id}`, { method: 'DELETE' }),

  // ── Sentences ─────────────────────────────────────────────────
  generateSentences: async (segmentId) => {
    const result = await request(`/api/segments/${segmentId}/generate-sentences`, { method: 'POST' });
    console.log('[api.generateSentences] raw API response:', JSON.stringify(result));
    return result;
  },

  listSentences: (segmentId) =>
    request(`/api/segments/${segmentId}/sentences`),

  updateSentence: (id, data) =>
    request(`/api/sentences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateSentenceText: async (id, data) => {
    const payload = {
      french_text: data.french_text,
      english_translation: data.english_translation,
    };
    console.log('Saving edited sentence:', payload);
    const response = await request(`/api/sentences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    console.log('Sentence update response:', response);
    return response;
  },

  retranslateSentence: async (id) => {
    console.log('Retranslating sentence:', id);
    const response = await request(`/api/sentences/${id}/retranslate`, { method: 'POST' });
    console.log('Retranslate response:', response);
    return response;
  },

  // ── Vocabulary ────────────────────────────────────────────────
  addVocabulary: (data) =>
    request('/api/vocabulary/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listVocabulary: (mastered) => {
    const params = mastered !== undefined ? `?mastered=${mastered}` : '';
    return request(`/api/vocabulary/${params}`);
  },

  updateVocabulary: (id, data) =>
    request(`/api/vocabulary/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteVocabulary: (id) =>
    request(`/api/vocabulary/${id}`, { method: 'DELETE' }),

  reviewVocabulary: (id, result) =>
    request(`/api/vocabulary/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    }),

  getDueReviews: () =>
    request('/api/vocabulary/due/today'),
};

/**
 * Convert a backend audio path (e.g. "uploads/segments/seg_1_q5_abc.mp3")
 * to a full URL reachable by the frontend.
 */
export function getAudioUrl(relativePath) {
  if (!relativePath) return null;
  const cleaned = relativePath.replace(/^uploads\//, '');
  return `${BASE_URL}/audio/${cleaned}`;
}
