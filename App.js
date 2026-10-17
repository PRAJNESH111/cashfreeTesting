import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ENV, ENV_ERROR } from "./src/config/env";
import { FormInput } from "./src/components/FormInput";
import { ResponseViewer } from "./src/components/ResponseViewer";
import {
  createOrder,
  refundPayment,
  verifyPayment,
} from "./src/features/payment/services/paymentApi";
import {
  launchCashfreeCheckout,
  registerCashfreeCallbacks,
} from "./src/features/payment/services/cashfreePayment";

const initialForm = {
  amount: "10",
  customerId: "TEST001",
  customerName: "Test User",
  customerEmail: "test@example.com",
  customerPhone: "9876543210",
};

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function maskSession(value) {
  return value
    ? `${value.slice(0, 6)}${"•".repeat(Math.max(0, value.length - 10))}${value.slice(-4)}`
    : "";
}

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState({
    checkout: "Not started",
    callback: null,
    verification: "Not started",
    verifiedStatus: null,
    response: null,
    error: null,
    loading: false,
    refund: {
      status: "Not started",
      response: null,
      error: null,
      loading: false,
    },
  });
  const [showSession, setShowSession] = useState(false);

  useEffect(
    () =>
      registerCashfreeCallbacks({
        onVerify: (orderId) => {
          setPayment((state) => ({
            ...state,
            checkout: "Callback received",
            callback: { type: "verify", orderId },
            error: null,
          }));
          verifyOrder(orderId);
        },
        onError: (error, orderId) =>
          setPayment((state) => ({
            ...state,
            checkout: "SDK error",
            callback: {
              type: "error",
              orderId,
              error: error?.message || error,
            },
            error: error?.message || "Cashfree checkout failed.",
          })),
      }),
    [],
  );

  async function verifyOrder(orderId = order?.orderId) {
    if (!orderId || payment.loading) return;
    setPayment((state) => ({
      ...state,
      verification: "Checking…",
      loading: true,
      error: null,
    }));
    try {
      const response = await verifyPayment(orderId);
      console.log(JSON.stringify(response, null, 2));
      setPayment((state) => ({
        ...state,
        verification: "Complete",
        verifiedStatus: response?.orderStatus || response?.status || "UNKNOWN",
        response,
        loading: false,
      }));
    } catch (error) {
      setPayment((state) => ({
        ...state,
        verification: "Failed",
        loading: false,
        error: errorMessage(error),
      }));
    }
  }

  async function refundOrder() {
    if (
      !order?.orderId ||
      payment.loading ||
      payment.refund.loading ||
      String(payment.verifiedStatus).toLowerCase() !== "paid"
    )
      return;

    setPayment((state) => ({
      ...state,
      refund: { ...state.refund, status: "Processing…", error: null, loading: true },
    }));
    try {
      const response = await refundPayment(order.orderId, {
        amount: null,
        refundId: null,
        reason: "Customer requested refund",
        instant: false,
      });
      console.log("Refund response:", JSON.stringify(response, null, 2));

      // Reuse the confirmation endpoint to refresh the order/refund status.
      const updatedPayment = await verifyPayment(order.orderId);
      setPayment((state) => ({
        ...state,
        verifiedStatus:
          updatedPayment?.orderStatus || updatedPayment?.status || state.verifiedStatus,
        response: updatedPayment,
        refund: { status: "Complete", response, error: null, loading: false },
      }));
    } catch (error) {
      setPayment((state) => ({
        ...state,
        refund: {
          ...state.refund,
          status: "Failed",
          error: errorMessage(error),
          loading: false,
        },
      }));
    }
  }

  const formErrors = useMemo(() => {
    const errors = {};
    if (
      !form.amount ||
      Number.isNaN(Number(form.amount)) ||
      Number(form.amount) <= 0
    )
      errors.amount = "Enter a positive amount.";
    if (!form.customerId.trim()) errors.customerId = "Customer ID is required.";
    if (!form.customerName.trim())
      errors.customerName = "Customer name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.customerEmail))
      errors.customerEmail = "Enter a valid email.";
    if (!/^\d{10}$/.test(form.customerPhone))
      errors.customerPhone = "Enter a 10-digit phone number.";
    return errors;
  }, [form]);

  async function createOrderAndPay() {
    if (Object.keys(formErrors).length || payment.loading) return;
    setPayment((state) => ({
      ...state,
      checkout: "Creating order…",
      loading: true,
      error: null,
      refund: {
        status: "Not started",
        response: null,
        error: null,
        loading: false,
      },
    }));
    setOrder(null);
    try {
      const response = await createOrder({
        amount: Number(form.amount),
        customerId: form.customerId.trim(),
        name: form.customerName.trim(),
        email: form.customerEmail.trim(),
        phone: form.customerPhone.trim(),
      });
      console.log(JSON.stringify(response, null, 2));
      if (!response?.orderId || !response?.paymentSessionId)
        throw new Error(
          "Backend response is missing orderId or paymentSessionId.",
        );
      const nextOrder = {
        orderId: response.orderId,
        paymentSessionId: response.paymentSessionId,
        response,
      };
      setOrder(nextOrder);
      setPayment((state) => ({
        ...state,
        checkout: "Launching…",
        loading: true,
      }));
      launchCashfreeCheckout({
        ...nextOrder,
        paymentEnvironment: ENV.PAYMENT_ENV,
      });
      setPayment((state) => ({ ...state, checkout: "Open", loading: false }));
    } catch (error) {
      setPayment((state) => ({
        ...state,
        checkout: "Failed",
        loading: false,
        error: errorMessage(error),
      }));
    }
  }

  function reset() {
    setForm(initialForm);
    setOrder(null);
    setShowSession(false);
    setPayment({
      checkout: "Not started",
      callback: null,
      verification: "Not started",
      verifiedStatus: null,
      response: null,
      error: null,
      loading: false,
      refund: {
        status: "Not started",
        response: null,
        error: null,
        loading: false,
      },
    });
  }
  function update(field, value) {
    setForm((state) => ({ ...state, [field]: value }));
  }
  const busy = payment.loading || payment.refund.loading;

  if (ENV_ERROR)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar style="dark" />
          <View style={styles.configError}>
            <Text style={styles.title}>Configuration required</Text>
            <Text style={styles.muted}>{ENV_ERROR}</Text>
            <ResponseViewer value="Create .env from .env.example, then restart Expo." />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.eyebrow}>CASHFREE DEVELOPER TOOL</Text>
            <Text style={styles.title}>Payment testing dashboard</Text>
            <Text style={styles.muted}>
              Frontend-only sandbox checkout and backend verification.
            </Text>
            <Section title="Customer and payment">
              <FormInput
                label="Amount"
                keyboardType="decimal-pad"
                value={form.amount}
                onChangeText={(v) => update("amount", v)}
                error={formErrors.amount}
              />
              <FormInput
                label="Customer ID"
                value={form.customerId}
                onChangeText={(v) => update("customerId", v)}
                error={formErrors.customerId}
              />
              <FormInput
                label="Customer name"
                value={form.customerName}
                onChangeText={(v) => update("customerName", v)}
                error={formErrors.customerName}
              />
              <FormInput
                label="Customer email"
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.customerEmail}
                onChangeText={(v) => update("customerEmail", v)}
                error={formErrors.customerEmail}
              />
              <FormInput
                label="Customer phone"
                keyboardType="phone-pad"
                value={form.customerPhone}
                onChangeText={(v) => update("customerPhone", v)}
                error={formErrors.customerPhone}
              />
              <Button
                full
                label={payment.loading ? "Working…" : "Create Order & Pay"}
                onPress={createOrderAndPay}
                disabled={busy || Object.keys(formErrors).length > 0}
              />
            </Section>
            {order ? (
              <Section title="Order information">
                <Info label="Order ID" value={order.orderId} />
                <Info
                  label="Payment session ID"
                  value={
                    showSession
                      ? order.paymentSessionId
                      : maskSession(order.paymentSessionId)
                  }
                />
                <Pressable onPress={() => setShowSession((value) => !value)}>
                  <Text style={styles.link}>
                    {showSession ? "Mask session ID" : "Reveal session ID"}
                  </Text>
                </Pressable>
                <Info label="Environment" value={ENV.PAYMENT_ENV} />
                <ResponseViewer value={order.response} />
              </Section>
            ) : null}
            <Section title="Payment result">
              <Info label="Checkout" value={payment.checkout} />
              <Info label="Verification" value={payment.verification} />
              <Info
                label="Verified status"
                value={payment.verifiedStatus || "—"}
              />
              {payment.callback ? (
                <ResponseViewer value={payment.callback} />
              ) : null}
              {payment.error ? (
                <Text style={styles.errorText}>{payment.error}</Text>
              ) : null}
              <ResponseViewer value={payment.response} />
              <Button
                full
                label="Verify Payment Status"
                onPress={() => verifyOrder()}
                disabled={!order?.orderId || busy}
              />
              {String(payment.verifiedStatus).toLowerCase() === "paid" ? (
                <>
                  <Info label="Refund" value={payment.refund.status} />
                  {payment.refund.error ? (
                    <Text style={styles.errorText}>{payment.refund.error}</Text>
                  ) : null}
                  <ResponseViewer value={payment.refund.response} />
                  <Button
                    full
                    label={payment.refund.loading ? "Refunding…" : "Refund Payment"}
                    onPress={refundOrder}
                    disabled={busy}
                  />
                </>
              ) : null}
              <Button
                full
                secondary
                label="Reset Screen"
                onPress={reset}
                disabled={busy}
              />
            </Section>
            <Text style={styles.footer}>
              SDK callbacks are not payment confirmation. The backend status is
              the source of truth.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}
function Button({ label, onPress, disabled, secondary, full }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        full && styles.fullButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {disabled && label === "Working…" ? (
        <ActivityIndicator color={secondary ? "#0F172A" : "#FFFFFF"} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: "#F1F5F9", flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 10,
  },
  title: { color: "#0F172A", fontSize: 28, fontWeight: "800", marginTop: 6 },
  muted: { color: "#64748B", fontSize: 14, lineHeight: 21, marginTop: 6 },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 2,
    marginTop: 18,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#2563EB",
    borderRadius: 10,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  fullButton: { width: "100%" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  secondaryButton: { backgroundColor: "#E2E8F0" },
  secondaryText: { color: "#0F172A" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  info: {
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingVertical: 9,
  },
  infoLabel: { color: "#64748B", fontSize: 12 },
  infoValue: { color: "#0F172A", fontSize: 14, marginTop: 3 },
  link: { color: "#2563EB", fontSize: 13, fontWeight: "700", marginTop: 10 },
  errorText: { color: "#B91C1C", fontSize: 13, marginTop: 12 },
  footer: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    textAlign: "center",
  },
  configError: { margin: 20, marginTop: 80 },
});
