const mongoose = require("mongoose");
const Notification = require("./src/models/Notification");
const User = require("./src/models/User");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: "test@gmail.com" });
  if (user) {
    const notifs = await Notification.find({ user_id: user._id }).sort({ createdAt: -1 }).limit(5);
    console.log(`Notifications for ${user.email} (${user._id}):`);
    notifs.forEach(n => {
        console.log(`  - [${n.type}] ${n.title}: ${n.message} (Read: ${n.is_read})`);
    });
  } else {
    console.log("User john@gmail.com not found");
  }
  await mongoose.disconnect();
}

check();
