const mongoose = require("mongoose");
const Transaction = require("./src/models/Transaction");
const Wallet = require("./src/models/Wallet");
const User = require("./src/models/User");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}, 'email first_name last_name');
  console.log("Users:", JSON.stringify(users, null, 2));
  
  for (const user of users) {
    const wallet = await Wallet.findOne({ user_id: user._id });
    const transactions = await Transaction.find({ user_id: user._id });
    console.log(`User ${user.email} (${user._id}):`);
    console.log(`  Wallet Balance: ${wallet ? wallet.balance : 'N/A'}`);
    console.log(`  Transactions: ${transactions.length}`);
    transactions.forEach(t => {
        console.log(`    - ${t.type}: ${t.amount} cents (${t.createdAt})`);
    });
  }
  
  await mongoose.disconnect();
}

check();
