const mongoose = require("mongoose");
const Transaction = require("./src/models/Transaction");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const Wallet = require("./src/models/Wallet");
  const User = require("./src/models/User");
  const user = await User.findOne({ email: 'test@gmail.com' });
  const wallet = await Wallet.findOne({ user_id: user._id });
  console.log(`User: ${user.email} | Balance: ${wallet.balance_display} EUR`);
  
  await mongoose.disconnect();
}

check();
