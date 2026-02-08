import { Stack } from "expo-router";

export default function RequestsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="available" />
      <Stack.Screen name="my-offers" />
      <Stack.Screen name="my-requests" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
