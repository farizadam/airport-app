import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuthStore } from "../../../src/store/authStore";
import { api } from "../../../src/lib/api";
import { toast } from "../../../src/store/toastStore";

const AVAILABLE_LANGUAGES = [
  "English", "French", "Arabic", "Spanish", "German", 
  "Italian", "Portuguese", "Chinese", "Japanese", "Korean",
  "Dutch", "Russian", "Turkish", "Hindi", "Polish"
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    date_of_birth: null as Date | null,
    bio: "",
    languages: [] as string[],
    car_model: "",
    car_color: "",
  });

  // Initialize form when user data is available
  useEffect(() => {
    if (user) {
      setEditForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        date_of_birth: user.date_of_birth ? new Date(user.date_of_birth) : null,
        bio: user.bio || "",
        languages: user.languages || [],
        car_model: user.car_model || "",
        car_color: user.car_color || "",
      });
    }
  }, [user]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: "cancel" },
      {
        text: 'Logout',
        style: "destructive",
        onPress: async () => {
          await logout();
          // Root layout will redirect to /login when isAuthenticated becomes false
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: "cancel" },
        {
          text: 'Delete',
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/users/me");
              await logout();
              // Root layout will redirect to /login when isAuthenticated becomes false
            } catch (error) {
              toast.error("Error", "Failed to delete account");
            }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const updateData = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        date_of_birth: editForm.date_of_birth?.toISOString() || null,
        bio: editForm.bio || null,
        languages: editForm.languages.length > 0 ? editForm.languages : null,
        car_model: editForm.car_model || null,
        car_color: editForm.car_color || null,
      };
      await api.put("/users/me", updateData);
      await refreshUser();
      setEditModalVisible(false);
      toast.success("Profile Updated", "Profile updated successfully");
    } catch (error) {
      toast.error("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setEditForm(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  // Image picker functions
  const pickImage = async () => {
    setAvatarModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.warning("Permission Required", "Please grant access to your photo library to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        // Show preview with upload button on same screen
        setPreviewImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    }
  };

  const takePhoto = async () => {
    setAvatarModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.warning("Permission Required", "Please grant access to your camera to take a profile picture.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        // Show preview with upload button on same screen
        setPreviewImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    }
  };

  const handleUploadPhoto = () => {
    if (previewImage) {
      uploadAvatar(previewImage.base64, previewImage.mimeType);
    }
  };

  const uploadAvatar = async (base64: string, mimeType: string) => {
    setUploadingAvatar(true);
    try {
      console.log("Uploading avatar, size:", Math.round(base64.length / 1024), "KB");
      await api.post("/users/me/avatar", {
        image: `data:${mimeType};base64,${base64}`,
      });
      await refreshUser();
      setPreviewImage(null);
      toast.success("Photo Updated", "Profile picture updated!");
    } catch (error: any) {
      console.error("Avatar upload error:", error.response?.data || error.message);
      toast.error("Upload Failed", error.response?.data?.message || "Failed to upload profile picture. Try a smaller image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const deleteAvatar = async () => {
    setAvatarModalVisible(false);
    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await api.delete("/users/me/avatar");
              await refreshUser();
              toast.success("Photo Removed", "Profile picture removed");
            } catch (error) {
              toast.error("Error", "Failed to remove profile picture");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "?";
  };

  const calculateAge = (dateOfBirth: string | Date | null | undefined): number | null => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString?: string | Date | null) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatMemberSince = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  const getVerificationStatus = () => {
    const items = [];
    if (user?.email_verified) {
      items.push({ label: "Email", verified: true });
    } else {
      items.push({ label: "Email", verified: false });
    }
    if (user?.phone_verified) {
      items.push({ label: "Phone", verified: true });
    } else {
      items.push({ label: "Phone", verified: false });
    }
    return items;
  };

  const getProfileCompletion = () => {
    if (!user) return 0;
    let completed = 0;
    const total = 9;
    
    if (user.first_name) completed++;
    if (user.last_name) completed++;
    if (user.email) completed++;
    if (user.phone) completed++;
    if (user.date_of_birth) completed++;
    if (user.bio) completed++;
    if (user.languages && user.languages.length > 0) completed++;
    if (user.car_model) completed++;
    if (user.car_color) completed++;
    
    return Math.round((completed / total) * 100);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEditForm({ ...editForm, date_of_birth: selectedDate });
    }
  };

  // Hooks must be called before any early return
  const age = calculateAge(user?.date_of_birth);
  const profileCompletion = useMemo(() => getProfileCompletion(), [
    user?.first_name, user?.last_name, user?.email, user?.phone, user?.date_of_birth,
    user?.bio, user?.languages, user?.car_model, user?.car_color
  ]);
  const verificationStatus = getVerificationStatus();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Gradient */}
        <LinearGradient
          colors={["#007AFF", "#0055CC"]}
          style={styles.headerGradient}
        >
          {/* Settings Button */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setEditModalVisible(true)}
          >
            <Ionicons name="create-outline" size={24} color="white" />
          </TouchableOpacity>

          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setAvatarModalVisible(true)}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="#007AFF" size="large" />
              </View>
            ) : user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={16} color="#007AFF" />
            </View>
          </TouchableOpacity>

          {/* Name */}
          <Text style={styles.userName}>
            {user?.first_name} {user?.last_name}
          </Text>

          {/* Quick Stats Row */}
          <View style={styles.statsRow}>
            {age !== null && (
              <>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{age}</Text>
                  <Text style={styles.statLabel}>years old</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            )}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatMemberSince(user?.createdAt)}</Text>
              <Text style={styles.statLabel}>member since</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={18} color="#FFD700" />
                <Text style={styles.statValue}>
                  {user?.rating && user.rating > 0 ? user.rating.toFixed(1) : "New"}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {user?.rating_count ? `${user.rating_count} reviews` : "reviews"}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Profile Completion Card */}
        {profileCompletion < 100 ? (
          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Ionicons name="shield-checkmark" size={24} color="#F59E0B" />
              <View style={styles.completionInfo}>
                <Text style={styles.completionTitle}>Complete Your Profile</Text>
                <Text style={styles.completionSubtitle}>
                  {profileCompletion}% complete
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(true)}>
                <Text style={styles.completionAction}>Complete</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${profileCompletion}%` }]} />
            </View>
          </View>
        ) : (
          <View style={[styles.completionCard, { borderColor: '#DCFCE7', borderWidth: 1 }]}>
            <View style={styles.completionHeader}>
              <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              <View style={styles.completionInfo}>
                <Text style={styles.completionTitle}>Profile Complete</Text>
                <Text style={[styles.completionSubtitle, { color: '#16A34A' }]}>
                  100% complete
                </Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#16A34A' }]} />
            </View>
          </View>
        )}

        {/* Verification Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Status</Text>
          <View style={styles.verificationCard}>
            {verificationStatus.map((item, index) => (
              <View key={index} style={styles.verificationItem}>
                <View style={[
                  styles.verificationIcon,
                  { backgroundColor: item.verified ? "#DCFCE7" : "#FEF3C7" }
                ]}>
                  <Ionicons
                    name={item.verified ? "checkmark-circle" : "alert-circle"}
                    size={20}
                    color={item.verified ? "#16A34A" : "#F59E0B"}
                  />
                </View>
                <Text style={styles.verificationLabel}>{item.label}</Text>
                <Text style={[
                  styles.verificationStatus,
                  { color: item.verified ? "#16A34A" : "#F59E0B" }
                ]}>
                  {item.verified ? "Verified" : "Pending"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => router.push('/(tabs)/profile/change-email')}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => router.push('/(tabs)/profile/change-phone')}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="call-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{user?.phone || "Not set"}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => setEditModalVisible(true)}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date of Birth</Text>
                <Text style={styles.infoValue}>
                  {user?.date_of_birth ? formatDate(user.date_of_birth) : "Not set"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="time-outline" size={20} color="#64748B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>{formatDate(user?.createdAt)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsCard}>
            {/* View Public Profile */}
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => router.push({ pathname: '/user-profile/[id]', params: { id: user?.id || user?._id } })}
            >
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#E0F2FE" }]}>
                  <Ionicons name="person-circle-outline" size={20} color="#0EA5E9" />
                </View>
                <Text style={styles.settingLabel}>View Public Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            {/* View Ratings */}
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => router.push('/(tabs)/profile/ratings')}
            >
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#FEF9C3" }]}>
                  <Ionicons name="star" size={20} color="#EAB308" />
                </View>
                <Text style={styles.settingLabel}>Ratings & Reviews</Text>
              </View>
              <View style={styles.settingRight}>
                {user?.rating && user.rating > 0 ? (
                  <Text style={styles.settingValue}>★ {user.rating.toFixed(1)}</Text>
                ) : (
                  <Text style={styles.settingValue}>New</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </View>
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="notifications-outline" size={20} color="#6366F1" />
                </View>
                <Text style={styles.settingLabel}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#E2E8F0", true: "#93C5FD" }}
                thumbColor={notificationsEnabled ? "#007AFF" : "#F4F4F5"}
              />
            </View>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/(tabs)/profile/privacy-policy")}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="shield-outline" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.settingLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.settingRow} onPress={() => router.push("/(tabs)/profile/terms-of-service")}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#F1F5F9" }]}>
                  <Ionicons name="document-text-outline" size={20} color="#64748B" />
                </View>
                <Text style={styles.settingLabel}>Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.accountCard}>
            <TouchableOpacity style={styles.accountRow} onPress={handleLogout}>
              <View style={styles.settingInfo}>
                <View style={[styles.settingIcon, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                </View>
                <Text style={[styles.settingLabel, { color: "#EF4444" }]}>Log Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FCA5A5" />
            </TouchableOpacity>

          </View>
        </View>

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>AirPool v1.0.0</Text>
          <Text style={styles.footerSubtext}>Airport Carpooling Made Easy</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.first_name}
                onChangeText={(text) => setEditForm({ ...editForm, first_name: text })}
                placeholder="Enter first name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={editForm.last_name}
                onChangeText={(text) => setEditForm({ ...editForm, last_name: text })}
                placeholder="Enter last name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Date of Birth</Text>
              <TouchableOpacity
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#64748B" />
                <Text style={[
                  styles.dateInputText,
                  !editForm.date_of_birth && { color: "#94A3B8" }
                ]}>
                  {editForm.date_of_birth 
                    ? formatDate(editForm.date_of_birth)
                    : "Select date of birth"
                  }
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={editForm.date_of_birth || new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1920, 0, 1)}
                />
              )}

              <Text style={styles.inputLabel}>Bio / About Me</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editForm.bio}
                onChangeText={(text) => setEditForm({ ...editForm, bio: text })}
                placeholder="Tell others about yourself..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Languages Spoken</Text>
              <View style={styles.languagesContainer}>
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.languageChip,
                      editForm.languages.includes(lang) && styles.languageChipSelected
                    ]}
                    onPress={() => toggleLanguage(lang)}
                  >
                    <Text style={[
                      styles.languageChipText,
                      editForm.languages.includes(lang) && styles.languageChipTextSelected
                    ]}>
                      {lang}
                    </Text>
                    {editForm.languages.includes(lang) && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Vehicle Information</Text>
              <Text style={styles.inputSubLabel}>Optional - for drivers</Text>
              
              <TextInput
                style={styles.input}
                value={editForm.car_model}
                onChangeText={(text) => setEditForm({ ...editForm, car_model: text })}
                placeholder="Car model (e.g., Toyota Corolla 2020)"
                placeholderTextColor="#94A3B8"
              />

              <TextInput
                style={styles.input}
                value={editForm.car_color}
                onChangeText={(text) => setEditForm({ ...editForm, car_color: text })}
                placeholder="Car color (e.g., Silver, Black, White)"
                placeholderTextColor="#94A3B8"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleUpdateProfile}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={avatarModalVisible}
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.avatarModalOverlay}
          activeOpacity={1}
          onPress={() => setAvatarModalVisible(false)}
        >
          <View style={styles.avatarModalContent}>
            <View style={styles.avatarModalHandle} />
            <Text style={styles.avatarModalTitle}>Profile Picture</Text>

            <TouchableOpacity style={styles.avatarOption} onPress={takePhoto}>
              <View style={[styles.avatarOptionIcon, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="camera" size={24} color="#6366F1" />
              </View>
              <Text style={styles.avatarOptionText}>Take Photo</Text>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.avatarOption} onPress={pickImage}>
              <View style={[styles.avatarOptionIcon, { backgroundColor: "#F0FDF4" }]}>
                <Ionicons name="images" size={24} color="#16A34A" />
              </View>
              <Text style={styles.avatarOptionText}>Choose from Gallery</Text>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>

            {user?.avatar_url && (
              <TouchableOpacity style={styles.avatarOption} onPress={deleteAvatar}>
                <View style={[styles.avatarOptionIcon, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="trash" size={24} color="#EF4444" />
                </View>
                <Text style={[styles.avatarOptionText, { color: "#EF4444" }]}>
                  Remove Photo
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#FCA5A5" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.avatarCancelButton}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.avatarCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Editor with Upload Button at Bottom */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={!!previewImage}
        onRequestClose={() => setPreviewImage(null)}
      >
        <SafeAreaView style={styles.editorScreen}>
          {/* Header */}
          <View style={styles.editorHeader}>
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              disabled={uploadingAvatar}
              style={styles.editorCloseButton}
            >
              <Ionicons name="close" size={28} color="#1E293B" />
            </TouchableOpacity>
            <Text style={styles.editorTitle}>Edit Photo</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Image Preview Area */}
          <View style={styles.editorImageContainer}>
            {previewImage && (
              <Image
                source={{ uri: previewImage.uri }}
                style={styles.editorImage}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Bottom Upload Button */}
          <View style={styles.editorBottomBar}>
            <TouchableOpacity
              style={styles.editorUploadButton}
              onPress={handleUploadPhoto}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.editorUploadText}>Upload Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },

  // Header
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  settingsButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 16,
    position: "relative",
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#007AFF",
  },
  cameraButton: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "white",
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
  },

  // Profile Completion
  completionCard: {
    margin: 16,
    marginTop: -15,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  completionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  completionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  completionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#007AFF",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
    borderRadius: 3,
  },

  // Section
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 10,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Verification Card
  verificationCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  verificationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  verificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  verificationLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    marginLeft: 12,
    fontWeight: "500",
  },
  verificationStatus: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Info Card
  infoCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  infoValue: {
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "500",
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 68,
  },

  // Settings Card
  settingsCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 15,
    color: "#1E293B",
    marginLeft: 12,
    fontWeight: "500",
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingValue: {
    fontSize: 14,
    color: "#64748B",
    marginRight: 8,
  },
  settingDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 62,
  },

  // Account Card
  accountCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: 30,
    paddingBottom: 50,
  },
  footerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  footerSubtext: {
    fontSize: 12,
    color: "#CBD5E1",
    marginTop: 4,
  },

  // Edit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E293B",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputSubLabel: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  languagesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  languageChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  languageChipText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  languageChipTextSelected: {
    color: "#fff",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
  },
  dateInputText: {
    fontSize: 16,
    color: "#1E293B",
    marginLeft: 10,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#007AFF",
  },
  cancelButtonText: {
    color: "#64748B",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },

  // Avatar Modal
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  avatarModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  avatarModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  avatarModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1E293B",
  },
  avatarOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatarOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOptionText: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    marginLeft: 14,
    fontWeight: "500",
  },
  avatarCancelButton: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    alignItems: "center",
  },
  avatarCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  // Full Screen Editor Styles
  editorScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  editorCloseButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  editorImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  editorImage: {
    width: "100%",
    height: "100%",
  },
  editorBottomBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  editorUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  editorUploadText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
});
