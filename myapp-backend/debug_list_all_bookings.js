const mongoose = require("mongoose");
const Booking = require("./src/models/Booking");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const bookings = await Booking.find({}, 'payment_intent_id status payment_status');
  console.log("Bookings and their PIs:");
  bookings.forEach(b => {
    console.log(`- ID: ${b._id} | PI: ${b.payment_intent_id} | Status: ${b.status} | Pay: ${b.payment_status}`);
  });
  
  await mongoose.disconnect();
}

check();
