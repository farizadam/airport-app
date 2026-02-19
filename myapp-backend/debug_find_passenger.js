const mongoose = require("mongoose");
const Transaction = require("./src/models/Transaction");
const Booking = require("./src/models/Booking");
const RideRequest = require("./src/models/RideRequest");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const tx = await Transaction.findById('6996787357cb55ecb68d9d88');
  if (tx) {
    console.log("Transaction:", JSON.stringify(tx, null, 2));
    const refId = tx.reference_id;
    
    // Check if it's a booking
    const booking = await Booking.findById(refId);
    if (booking) {
        console.log("Booking:", JSON.stringify(booking, null, 2));
    } else {
        // Check if it's a RideRequest
        const request = await RideRequest.findById(refId);
        if (request) {
            console.log("RideRequest:", JSON.stringify(request, null, 2));
        }
    }
  } else {
    console.log("TX not found");
  }
  
  await mongoose.disconnect();
}

check();
