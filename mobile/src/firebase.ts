import { getAuth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, signOut as firebaseSignOut } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";

// Initialize native auth instance using modular API
const app = getApp();
const auth = getAuth(app);

console.log("🔥 Native Firebase loaded (modular API)");

// Helper function for getting ID token (using modular API)
export const getIdToken = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  return user.getIdToken(true);
};

export { auth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, firebaseSignOut };
export default app;
