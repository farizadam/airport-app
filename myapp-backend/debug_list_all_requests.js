const mongoose = require("mongoose");
const RideRequest = require("./src/models/RideRequest");
require("dotenv").config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const requests = await RideRequest.find({}, 'offers passenger status payment_status');
  console.log("RideRequests and their PIs:");
  requests.forEach(r => {
    const pis = r.offers.map(o => o.payment_intent_id).filter(Boolean);
    if (pis.length > 0) {
        console.log(`- ID: ${r._id} | PIs: ${pis.join(',')} | Status: ${r.status} | Pay: ${r.payment_status}`);
    }
  });
  
  await mongoose.disconnect();
}

check();
