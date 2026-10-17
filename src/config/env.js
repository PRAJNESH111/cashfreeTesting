const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const rawPaymentEnvironment = process.env.EXPO_PUBLIC_PAYMENT_ENV;

const normalizedPaymentEnvironment = rawPaymentEnvironment?.trim().toLowerCase();
const apiBaseUrl = rawApiBaseUrl?.trim().replace(/\/+$/, '');

export const ENV_ERROR = !apiBaseUrl
  ? 'EXPO_PUBLIC_API_BASE_URL is missing. Copy .env.example to .env and set a reachable backend URL.'
  : !/^https?:\/\//i.test(apiBaseUrl)
    ? 'EXPO_PUBLIC_API_BASE_URL must start with http:// or https://.'
    : !['sandbox', 'production'].includes(normalizedPaymentEnvironment)
      ? 'EXPO_PUBLIC_PAYMENT_ENV must be sandbox or production.'
      : null;

export const ENV = ENV_ERROR
  ? null
  : {
      API_BASE_URL: apiBaseUrl,
      PAYMENT_ENV: normalizedPaymentEnvironment,
    };
