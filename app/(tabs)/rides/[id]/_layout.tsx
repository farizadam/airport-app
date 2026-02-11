import { Stack } from "expo-router";

export default function RideIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="bookings" />
    </Stack>
  );
}
