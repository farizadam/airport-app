const mongoose = require("mongoose");
const RideRequest = require("./src/models/RideRequest");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Booking = require("./src/models/Booking");
  const request = await Booking.findOne({ payment_intent_id: 'pi_3T2NB5QtnKCt6RdV0MOSspll' }).populate('passenger_id');
  if (request) {
    console.log("Booking:", JSON.stringify(request, null, 2));
    console.log("Passenger Email:", request.passenger_id?.email);
  } else {
    console.log("Booking not found");
  }
  
  await mongoose.disconnect();
}

check();
