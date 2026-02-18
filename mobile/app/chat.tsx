import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Linking,
} from "react-native";
import { toast } from "../src/store/toastStore";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../src/lib/api";
import { useAuthStore } from "../src/store/authStore";
import ProfileAvatar from "../src/components/ProfileAvatar";
import { format } from "date-fns";

interface Message {
  _id: string;
  id: string;
  sender_id: {
    _id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  receiver_id: {
    _id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  content: string;
  message_type: "text" | "image";
  image_url?: string;
  read: boolean;
  createdAt: string;
}

interface ChatInfo {
  other_user: {
    _id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    phone?: string;
  };
  booking: {
    id: string;
    status: string;
    seats: number;
  };
  ride: {
    id: string;
    home_city?: string;
    home_address?: string;
    airport_name?: string;
    airport_code?: string;
    departure?: string;
    direction: string;
  };
  is_driver: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const { bookingId, requestId } = useLocalSearchParams<{ bookingId?: string; requestId?: string }>();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);

  // Clear state when bookingId or requestId changes to prevent showing old messages
  useEffect(() => {
    console.log("🔄 Chat params changed:", { bookingId, requestId });
    // Reset state for new chat
    setMessages([]);
    setChatInfo(null);
    setLoading(true);
    setInputText("");
    setPreviewImage(null);
    setSelectedImage(null);
  }, [bookingId, requestId]);

  // Fetch chat info and messages
  const fetchChatData = useCallback(async () => {
    if (!bookingId && !requestId) {
      console.log("No bookingId or requestId provided");
      return;
    }

    const chatType = requestId ? 'request' : 'booking';
    const chatId = requestId || bookingId;
    console.log(`📨 Fetching ${chatType} chat data for:`, chatId);

    try {
      const endpoint = requestId ? `/chat/request/${chatId}` : `/chat/${chatId}`;
      const infoEndpoint = requestId ? `/chat/request/${chatId}/info` : `/chat/${chatId}/info`;
      
      const [infoRes, messagesRes] = await Promise.all([
        api.get(infoEndpoint),
        api.get(endpoint),
      ]);

      console.log("✅ Chat info response:", JSON.stringify(infoRes.data, null, 2));
      console.log("✅ Messages count:", messagesRes.data.data?.length || 0);

      setChatInfo(infoRes.data.data);
      setMessages(messagesRes.data.data || []);
    } catch (error: any) {
      console.error("❌ Fetch chat data error:", error?.response?.data || error.message);
      toast.error("Error", error.response?.data?.message || "Failed to load chat");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [bookingId, requestId]);

  useFocusEffect(
    useCallback(() => {
      fetchChatData();
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        const chatId = requestId || bookingId;
        if (chatId) {
          const endpoint = requestId ? `/chat/request/${chatId}` : `/chat/${chatId}`;
          api.get(endpoint).then((res) => {
            setMessages(res.data.data || []);
          }).catch(() => {});
        }
      }, 5000);

      return () => clearInterval(interval);
    }, [fetchChatData, bookingId, requestId])
  );

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const chatId = requestId || bookingId;
      const endpoint = requestId ? `/chat/request/${chatId}` : `/chat/${chatId}`;
      
      const res = await api.post(endpoint, {
        content: text,
        message_type: "text",
      });

      setMessages((prev) => [...prev, res.data.data]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      toast.error("Error", "Failed to send message");
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const pickImage = async () => {
    setImageModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.warning("Permission Required", "Please grant access to your photo library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        setPreviewImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    }
  };

  const takePhoto = async () => {
    setImageModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.warning("Permission Required", "Please grant access to your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.5,
      base64: true,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        setPreviewImage({
          uri: asset.uri,
          base64: asset.base64,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    }
  };

  const confirmSendImage = () => {
    if (previewImage) {
      sendImageMessage(previewImage.base64, previewImage.mimeType);
      setPreviewImage(null);
    }
  };

  const cancelPreview = () => {
    setPreviewImage(null);
  };

  const sendImageMessage = async (base64: string, mimeType: string) => {
    setUploadingImage(true);
    try {
      console.log("Sending image, size:", Math.round(base64.length / 1024), "KB");
      const chatId = requestId || bookingId;
      const endpoint = requestId ? `/chat/request/${chatId}` : `/chat/${chatId}`;
      
      const res = await api.post(endpoint, {
        content: "",
        message_type: "image",
        image: `data:${mimeType};base64,${base64}`,
      });

      setMessages((prev) => [...prev, res.data.data]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      console.error("Image upload error:", error.response?.data || error.message);
      toast.error("Upload Failed", error.response?.data?.message || "Failed to send image. Try a smaller image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(date, "HH:mm");
    }
    return format(date, "MMM d, HH:mm");
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const sender = item.sender_id as { _id?: string; first_name?: string; last_name?: string; avatar_url?: string } | string;
    const senderId = typeof sender === "object" && sender !== null ? sender._id : sender;
    const isMyMessage = senderId === user?.id;

    return (
      <View style={[styles.messageRow, isMyMessage && styles.myMessageRow]}>
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            <ProfileAvatar
              userId={typeof sender === "object" && sender !== null ? sender._id : sender}
              firstName={typeof sender === "object" && sender !== null ? sender.first_name : undefined}
              lastName={typeof sender === "object" && sender !== null ? sender.last_name : undefined}
              avatarUrl={typeof sender === "object" && sender !== null ? sender.avatar_url : undefined}
              size="small"
            />
          </View>
        )}
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
          {item.message_type === "image" && item.image_url ? (
            <TouchableOpacity onPress={() => setSelectedImage(item.image_url || null)}>
              <Image source={{ uri: item.image_url }} style={styles.messageImage} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMyMessage && (
              <Ionicons
                name={item.read ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.read ? "#60A5FA" : "rgba(255,255,255,0.6)"}
                style={{ marginLeft: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerTitle}
          onPress={() => chatInfo?.other_user?._id && router.push({ pathname: "/user-profile/[id]", params: { id: chatInfo.other_user._id } })}
          activeOpacity={0.7}
        >
          <ProfileAvatar
            userId={chatInfo?.other_user?._id}
            firstName={chatInfo?.other_user?.first_name}
            lastName={chatInfo?.other_user?.last_name}
            avatarUrl={chatInfo?.other_user?.avatar_url}
            size="small"
            disabled
          />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>
              {chatInfo?.other_user?.first_name || "User"} {chatInfo?.other_user?.last_name || ""}
            </Text>
            <Text style={styles.headerRole}>
              {chatInfo?.is_driver ? "Passenger" : "Driver"}
            </Text>
          </View>
        </TouchableOpacity>
        {chatInfo?.other_user?.phone && (
          <TouchableOpacity 
            style={styles.headerCall}
            onPress={() => Linking.openURL(`tel:${chatInfo.other_user.phone}`)}
          >
            <Ionicons name="call-outline" size={22} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior="padding"
        keyboardVerticalOffset={90}
      >
        {/* Trip Info Banner - Clickable to view ride */}
        {chatInfo?.ride && (
          <TouchableOpacity 
            style={styles.tripBanner}
            onPress={() => {
              if (chatInfo.ride?.id) {
                // Navigate based on user role
                if (chatInfo.is_driver) {
                  router.push({ pathname: "/(tabs)/rides/[id]", params: { id: chatInfo.ride.id } });
                } else {
                  router.push({ pathname: "/ride-details/[id]", params: { id: chatInfo.ride.id } });
                }
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="car-outline" size={16} color="#64748B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tripBannerText} numberOfLines={1}>
                {(chatInfo.ride.direction === "home_to_airport" || chatInfo.ride.direction === "to_airport")
                  ? `${chatInfo.ride.home_city || "City"} → ${chatInfo.ride.airport_name || "Airport"}`
                  : `${chatInfo.ride.airport_name || "Airport"} → ${chatInfo.ride.home_city || "City"}`}
              </Text>
              {chatInfo.ride.departure && (
                <Text style={styles.tripBannerDate}>
                  {format(new Date(chatInfo.ride.departure), "EEE, MMM d 'at' HH:mm")}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id || item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSubtext}>
                  Say hello to {chatInfo?.other_user?.first_name}!
                </Text>
              </View>
            }
          />

          {/* Uploading Image Indicator */}
          {uploadingImage && (
            <View style={styles.uploadingBanner}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.uploadingText}>Uploading image...</Text>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => setImageModalVisible(true)}
              disabled={uploadingImage}
            >
              <Ionicons name="add-circle-outline" size={28} color="#007AFF" />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Image Options Modal */}
        <Modal
          visible={imageModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setImageModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Send Photo</Text>

              <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
                <View style={[styles.modalOptionIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="camera" size={24} color="#6366F1" />
                </View>
                <Text style={styles.modalOptionText}>Take Photo</Text>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalOption} onPress={pickImage}>
                <View style={[styles.modalOptionIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="images" size={24} color="#16A34A" />
                </View>
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setImageModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Full Screen Image Viewer */}
        <Modal
          visible={!!selectedImage}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedImage(null)}
        >
          <View style={styles.imageViewerOverlay}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>

        {/* Image Preview Modal - Before Sending */}
        <Modal
          visible={!!previewImage}
          transparent={false}
          animationType="slide"
          onRequestClose={cancelPreview}
        >
          <View style={styles.previewContainer}>
            {/* Preview Header */}
            <View style={styles.previewHeader}>
              <TouchableOpacity onPress={cancelPreview} style={styles.previewHeaderBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.previewHeaderTitle}>Preview</Text>
              <View style={styles.previewHeaderBtn} />
            </View>

            {/* Image Preview */}
            <View style={styles.previewImageContainer}>
              {previewImage && (
                <Image
                  source={{ uri: previewImage.uri }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              )}
            </View>

            {/* Preview Footer with Actions */}
            <View style={styles.previewFooter}>
              <TouchableOpacity 
                style={styles.previewCancelBtn} 
                onPress={cancelPreview}
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text style={styles.previewCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.previewSendBtn} 
                onPress={confirmSendImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={22} color="#fff" />
                    <Text style={styles.previewSendText}>Send Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  keyboardView: {
    flex: 1,
  },

  // Header
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerBack: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#64748B",
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  headerRole: {
    fontSize: 12,
    color: "#64748B",
  },
  headerCall: {
    padding: 8,
  },

  // Trip Banner
  tripBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
    gap: 10,
  },
  tripBannerText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
  },
  tripBannerDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // Messages
  messagesList: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  avatarContainer: {
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#64748B",
  },
  messageBubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessage: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontSize: 15,
    color: "#1E293B",
    lineHeight: 20,
  },
  myMessageText: {
    color: "#fff",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: "#94A3B8",
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.7)",
  },

  // Empty State
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyChatText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 16,
  },
  emptyChatSubtext: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 4,
  },

  // Uploading Banner
  uploadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#3B82F6",
  },

  // Input
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  attachButton: {
    padding: 6,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1E293B",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1E293B",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    marginLeft: 14,
    fontWeight: "500",
  },
  modalCancel: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },

  // Image Viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullScreenImage: {
    width: "100%",
    height: "80%",
  },

  // Image Preview Modal
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  previewHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  previewHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 16,
  },
  previewCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    gap: 8,
  },
  previewCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EF4444",
  },
  previewSendBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    gap: 8,
  },
  previewSendText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
