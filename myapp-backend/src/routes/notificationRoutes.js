const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

// Get all notifications for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user_id: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Mark a notification as read
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { is_read: true },
      { new: true }
    );
    if (!notif)
      return res.status(404).json({ message: "Notification not found" });
    res.json({ notification: notif });
  } catch (error) {
    res.status(500).json({ message: "Failed to update notification" });
  }
});

module.exports = router;
