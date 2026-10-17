import { Platform } from 'react-native';
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { CFEnvironment, CFSession } from 'cashfree-pg-api-contract';

export function registerCashfreeCallbacks({ onVerify, onError }) {
  if (Platform.OS === 'web') return () => {};

  CFPaymentGatewayService.setCallback({ onVerify, onError });
  return () => CFPaymentGatewayService.removeCallback();
}

export function launchCashfreeCheckout({ paymentSessionId, orderId, paymentEnvironment }) {
  if (Platform.OS === 'web') throw new Error('Cashfree checkout requires an Android or iOS development build.');

  const environment = paymentEnvironment === 'production'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;
  const session = new CFSession(paymentSessionId, orderId, environment);
  CFPaymentGatewayService.doWebPayment(session);
}
