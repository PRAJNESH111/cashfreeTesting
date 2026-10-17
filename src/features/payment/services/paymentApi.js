import { ENV } from '../../../config/env';

const REQUEST_TIMEOUT_MS = 150000;// 2.5 minutes

async function request(path, options = {}) {
  if (!ENV) throw new Error('Environment configuration is invalid.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Check the device network and backend URL.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOrder(order) {
  return request('/api/payments/create', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

export function verifyPayment(orderId) {
  return request(`/api/payments/confirm/${encodeURIComponent(orderId)}`, {
    method: 'GET',
  });
}

export function refundPayment(orderId, refundRequest) {
  return request(
    `/api/admin/payments/refund/${encodeURIComponent(orderId)}`,
    {
      method: "POST",
      body: JSON.stringify(refundRequest),
    }
  );
}
