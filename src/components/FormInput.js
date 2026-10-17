import { StyleSheet, Text, TextInput, View } from 'react-native';

export function FormInput({ label, error, ...props }) {
  return <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <TextInput {...props} style={[styles.input, error && styles.inputError]} placeholderTextColor="#94A3B8" />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1', borderRadius: 10, borderWidth: 1, color: '#0F172A', fontSize: 16, paddingHorizontal: 12, paddingVertical: 11 },
  inputError: { borderColor: '#DC2626' },
  error: { color: '#B91C1C', fontSize: 12, marginTop: 4 },
});
