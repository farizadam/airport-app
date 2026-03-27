import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { RatingUser, useRatingStore } from "../store/ratingStore";

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bookingId: string;
  targetUser: RatingUser;
  ratingType: "driver_to_passenger" | "passenger_to_driver";
}

export default function RatingModal({
  visible,
  onClose,
  onSuccess,
  bookingId,
  targetUser,
  ratingType,
}: RatingModalProps) {
  const { submitRating, isLoading } = useRatingStore();
  const [selectedStars, setSelectedStars] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (selectedStars === 0) {
      setError("Please select a rating");
      return;
    }

    setError("");
    const success = await submitRating(bookingId, selectedStars, comment);
    
    if (success) {
      // Reset form
      setSelectedStars(0);
      setComment("");
      onSuccess?.();
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedStars(0);
    setComment("");
    setError("");
    onClose();
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setSelectedStars(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= selectedStars ? "star" : "star-outline"}
              size={40}
              color={star <= selectedStars ? "#FFD700" : "#CBD5E1"}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getStarLabel = () => {
    switch (selectedStars) {
      case 1:
        return "Terrible";
      case 2:
        return "Poor";
      case 3:
        return "Okay";
      case 4:
        return "Good";
      case 5:
        return "Excellent";
      default:
        return "Tap to rate";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.title}>
                  {ratingType === "passenger_to_driver"
                    ? "Rate your driver"
                    : "Rate your passenger"}
                </Text>
              </View>

              {/* User Info */}
              <View style={styles.userSection}>
                {targetUser.avatar_url ? (
                  <Image
                    source={{ uri: targetUser.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="#94A3B8" />
                  </View>
                )}
                <Text style={styles.userName}>
                  {targetUser.first_name} {targetUser.last_name}
                </Text>
                {targetUser.rating !== undefined && targetUser.rating > 0 && (
                  <View style={styles.currentRating}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.currentRatingText}>
                      {targetUser.rating.toFixed(1)} ({targetUser.rating_count || 0})
                    </Text>
                  </View>
                )}
              </View>

              {/* Star Rating */}
              <View style={styles.ratingSection}>
                <Text style={styles.ratingLabel}>How was your experience?</Text>
                {renderStars()}
                <Text style={styles.starLabel}>{getStarLabel()}</Text>
              </View>

              {/* Comment Input */}
              <View style={styles.commentSection}>
                <Text style={styles.commentLabel}>Leave a comment (optional)</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Share your experience..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  value={comment}
                  onChangeText={setComment}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{comment.length}/500</Text>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading || selectedStars === 0}
                style={[
                  styles.submitButton,
                  (isLoading || selectedStars === 0) && styles.submitButtonDisabled,
                ]}
              >
                <LinearGradient
                  colors={
                    selectedStars === 0
                      ? ["#94A3B8", "#64748B"]
                      : ["#3B82F6", "#2563EB"]
                  }
                  style={styles.submitGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#FFFFFF" />
                      <Text style={styles.submitText}>Submit Rating</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Skip Button */}
              <TouchableOpacity onPress={handleClose} style={styles.skipButton}>
                <Text style={styles.skipText}>Rate Later</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginRight: 40,
  },
  userSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  currentRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currentRatingText: {
    fontSize: 14,
    color: "#64748B",
  },
  ratingSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#475569",
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  starButton: {
    padding: 4,
  },
  starLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
    marginTop: 8,
  },
  commentSection: {
    marginBottom: 20,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#475569",
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1E293B",
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  charCount: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "right",
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  submitButton: {
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipText: {
    color: "#64748B",
    fontSize: 14,
  },
});
