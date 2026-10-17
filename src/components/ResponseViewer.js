import { StyleSheet, Text, View } from 'react-native';

export function ResponseViewer({ value }) {
  if (value == null) return null;
  const output = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <View style={styles.container}><Text selectable style={styles.text}>{output}</Text></View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0F172A', borderRadius: 10, marginTop: 10, padding: 12 },
  text: { color: '#E2E8F0', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
});
