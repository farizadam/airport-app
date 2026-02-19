require("dotenv").config();
const mongoose = require("mongoose");
const RefundService = require("./src/services/refundService");
const RideRequest = require("./src/models/RideRequest");
const User = require("./src/models/User");

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find a paid request
  const request = await RideRequest.findOne({ payment_status: 'paid' }).populate('passenger').populate('matched_driver');
  
  if (!request) {
    console.log("No paid request found to test with.");
    await mongoose.disconnect();
    return;
  }
  
  console.log(`Testing refund for request ${request._id}`);
  console.log(`Passenger: ${request.passenger?.email} (${request.passenger?._id})`);
  console.log(`Driver: ${request.matched_driver?.email} (${request.matched_driver?._id})`);

  try {
    const result = await RefundService.processRideRequestRefund(request, "automated_test");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("CRASHED:", err);
  }
  
  await mongoose.disconnect();
}

test();
