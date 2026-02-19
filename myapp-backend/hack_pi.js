const mongoose = require("mongoose");
const RideRequest = require("./src/models/RideRequest");
require("dotenv").config();

async function hack() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const request = await RideRequest.findOne({ _id: '6996095d589b629d0c4827e6' });
  if (request) {
    const offer = request.offers.find(o => o.status === 'accepted');
    if (offer) {
        offer.payment_intent_id = 'pi_3T2NB5QtnKCt6RdV0MOSspll';
        await request.save();
        console.log("Updated request with PI");
    }
  }
  
  await mongoose.disconnect();
}

hack();
