const mongoose = require("mongoose");
const RideRequest = require("./src/models/RideRequest");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const request = await RideRequest.findOne({ 'offers.payment_intent_id': { $exists: true, $ne: null } });
  if (request) {
    console.log("Found request with payment_intent_id:", request._id);
    const acceptedOffer = request.offers.find(o => o.status === 'accepted');
    console.log("Offer PI:", acceptedOffer ? acceptedOffer.payment_intent_id : 'No accepted offer with PI');
  } else {
    console.log("No request found with payment_intent_id");
  }
  
  await mongoose.disconnect();
}

check();
