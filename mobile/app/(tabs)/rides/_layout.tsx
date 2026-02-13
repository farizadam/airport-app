import { Stack } from "expo-router";

export default function RidesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="my-rides" />
      <Stack.Screen name="search" />
      <Stack.Screen name="results" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
