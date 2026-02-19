const mongoose = require("mongoose");
const RideRequest = require("./src/models/RideRequest");
const User = require("./src/models/User");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const requests = await RideRequest.find().sort({ updated_at: -1 }).limit(5).populate('passenger').populate('matched_driver');
  console.log("Recent RideRequests:");
  for (const r of requests) {
    console.log(`ID: ${r._id}`);
    console.log(`  Passenger: ${r.passenger?.email} (${r.passenger?._id})`);
    console.log(`  Driver: ${r.matched_driver?.email} (${r.matched_driver?._id})`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Payment Status: ${r.payment_status}`);
    const acceptedOffer = r.offers.find(o => o.status === 'accepted');
    console.log(`  Accepted Offer: ${acceptedOffer ? JSON.stringify(acceptedOffer) : 'None'}`);
    console.log(`---`);
  }
  
  await mongoose.disconnect();
}

check();
