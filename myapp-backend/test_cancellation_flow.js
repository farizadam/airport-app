const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Connect to database
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/airport_rideshare';
mongoose.connect(MONGO_URI);

// Import models
const RideRequest = require('./src/models/RideRequest');
const Ride = require('./src/models/Ride');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');
const Wallet = require('./src/models/Wallet');
const Transaction = require('./src/models/Transaction');
const Airport = require('./src/models/Airport');

// Import services and controllers directly or use their logic
const RefundService = require('./src/services/refundService');
const rideRequestController = require('./src/controllers/rideRequestController');

async function testCancellationFlow() {
  console.log('🧪 Starting Cancellation & Refund Flow Test...');
  
  let testPassenger, testDriver, testRide, testRequest, testAirport;

  try {
    // 1. Setup Test Data
    console.log('--- 1. Setting up test data ---');
    
    // Find or create airport
    testAirport = await Airport.findOne({});
    if (!testAirport) {
        testAirport = await Airport.create({
            name: "Test Airport",
            code: "Tst",
            city: "Test City",
            location: { type: "Point", coordinates: [0, 0] }
        });
    }

    // Create unique test users
    const timestamp = Date.now();
    testPassenger = await User.create({
      first_name: 'Test',
      last_name: 'Passenger',
      email: `passenger_${timestamp}@test.com`,
      phone: `+123456789${timestamp % 10}`,
      password: 'password123',
      role: 'passenger'
    });

    testDriver = await User.create({
      first_name: 'Test',
      last_name: 'Driver',
      email: `driver_${timestamp}@test.com`,
      phone: `+987654321${timestamp % 10}`,
      password: 'password123',
      role: 'driver'
    });

    // Create Wallets
    const passengerWallet = await Wallet.getOrCreateWallet(testPassenger._id);
    const driverWallet = await Wallet.getOrCreateWallet(testDriver._id);

    // Initial balance (give passenger some money)
    passengerWallet.balance = 10000; // €100.00
    await passengerWallet.save();
    console.log(`✅ Passenger created with €100.00: ${testPassenger._id}`);
    console.log(`✅ Driver created: ${testDriver._id}`);

    // Create Ride (by Driver)
    testRide = await Ride.create({
      driver_id: testDriver._id,
      airport_id: testAirport._id,
      direction: 'home_to_airport',
      home_city: 'Test City',
      datetime_start: new Date(Date.now() + 86400000 * 2), // 2 days from now
      seats_total: 4,
      seats_left: 4,
      luggage_capacity: 4,
      luggage_left: 4,
      price_per_seat: 40, // €40.00
      status: 'active',
      route: {
        type: 'LineString',
        coordinates: [[0.1278, 51.5074], [0.1279, 51.5075]] // Dummy coords
      }
    });
    console.log(`✅ Ride created: ${testRide._id} at €40.00/seat`);

    // Create Request (by Passenger)
    testRequest = await RideRequest.create({
      passenger: testPassenger._id,
      airport: testAirport._id,
      direction: 'to_airport',
      location_address: '123 Test Street',
      location_city: 'Test City',
      location_latitude: 51.5074,
      location_longitude: 0.1278,
      location: {
        type: 'Point',
        coordinates: [0.1278, 51.5074]
      },
      preferred_datetime: testRide.datetime_start,
      expires_at: new Date(Date.now() + 86400000), // 1 day from now
      seats_needed: 1,
      luggage_count: 1,
      status: 'pending'
    });
    console.log(`✅ Request created: ${testRequest._id}`);

    // 2. Simulate Acceptance & Matching
    console.log('\n--- 2. Simulating Offer & Acceptance ---');
    
    // Mock the "Accept Offer" result
    // In a real flow, this would create a booking and update request status
    const seats = testRequest.seats_needed;
    const price = testRide.price_per_seat * 100; // cents
    const feePercent = 10;
    const driverEarnings = Math.round(price * ((100 - feePercent) / 100));

    // Create Booking
    const booking = await Booking.create({
      ride_id: testRide._id,
      passenger_id: testPassenger._id,
      seats: seats,
      luggage_count: testRequest.luggage_count,
      status: 'accepted',
      payment_status: 'paid', // Simulate payment already done
      payment_method: 'wallet'
    });

    // Update Request status to link with ride/driver
    testRequest.status = 'accepted';
    testRequest.matched_driver = testDriver._id;
    testRequest.matched_ride = testRide._id;
    await testRequest.save();

    // Update Ride (take seats)
    testRide.seats_left -= seats;
    testRide.luggage_left -= testRequest.luggage_count;
    await testRide.save();

    // Update Wallets (simulate payment)
    passengerWallet.balance -= price;
    await passengerWallet.save();

    driverWallet.balance += driverEarnings;
    driverWallet.total_earned += driverEarnings;
    await driverWallet.save();

    console.log(`✅ Acceptance simulated: Booking ${booking._id} created.`);
    console.log(`✅ Funds moved: Passenger -€40.00, Driver +€36.00 (10% fee)`);
    console.log(`✅ Driver balance: €${(driverWallet.balance / 100).toFixed(2)}`);

    // 3. Trigger Cancellation
    console.log('\n--- 3. Triggering Cancellation Flow ---');
    
    // We'll call the controller's cancelRequest logic
    // We need to mock req and res
    const req = {
        params: { id: testRequest._id.toString() },
        user: { id: testPassenger._id.toString() }
    };
    
    const res = {
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.data = data; return this; }
    };
    
    const next = (err) => { if (err) console.error('Next Error:', err); };

    await rideRequestController.cancelRequest(req, res, next);
    console.log('✅ cancelRequest called. Result:', res.data?.message);

    // 4. Verify Results
    console.log('\n--- 4. Verifying Results ---');
    
    // A. Request should be deleted
    const deletedRequest = await RideRequest.findById(testRequest._id);
    console.log(deletedRequest ? '❌ Request NOT deleted' : '✅ Request deleted successfully');

    // B. Booking should be cancelled
    const updatedBooking = await Booking.findById(booking._id);
    console.log(`📊 Booking status: ${updatedBooking.status}`);
    console.log(updatedBooking.status === 'cancelled' ? '✅ Booking marked as cancelled' : '❌ Booking status mismatch');
    console.log(`📊 Booking payment status: ${updatedBooking.payment_status}`);

    // C. Seats should be released
    const updatedRide = await Ride.findById(testRide._id);
    console.log(`📊 Ride seats left: ${updatedRide.seats_left}`);
    console.log(updatedRide.seats_left === 4 ? '✅ Seats released successfully' : '❌ Seats NOT released');

    // D. Refund verification
    const updatedPassengerWallet = await Wallet.findOne({ user_id: testPassenger._id });
    const updatedDriverWallet = await Wallet.findOne({ user_id: testDriver._id });

    console.log(`📊 Passenger balance: €${(updatedPassengerWallet.balance / 100).toFixed(2)}`);
    console.log(`📊 Driver balance: €${(updatedDriverWallet.balance / 100).toFixed(2)}`);

    // Passenger should have 10000 - 4000 + 3600 = 9600 (€96.00)
    // Driver should have 0 + 3600 - 3600 = 0 (€0.00)
    
    if (updatedPassengerWallet.balance === 9600) {
        console.log('✅ Passenger received partial refund (€36.00, fees €4.00 kept by platform)');
    } else {
        console.log(`❌ Passenger refund mismatch. Expected 9600, got ${updatedPassengerWallet.balance}`);
    }

    if (updatedDriverWallet.balance === 0) {
        console.log('✅ Driver balance returned to 0 (all earnings reversed)');
    } else {
        console.log(`❌ Driver deduction mismatch. Expected 0, got ${updatedDriverWallet.balance}`);
    }

    // E. Transaction check
    const transactions = await Transaction.find({ reference_id: booking._id });
    console.log(`📊 Found ${transactions.length} refund/reversal transactions`);
    transactions.forEach(t => {
        console.log(`   - ${t.user_id.toString() === testPassenger._id.toString() ? 'Passenger' : 'Driver'}: ${t.amount / 100} EUR (${t.description})`);
    });

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\n--- 5. Cleaning up ---');
    if (testPassenger) await User.deleteOne({ _id: testPassenger._id });
    if (testDriver) await User.deleteOne({ _id: testDriver._id });
    if (testRide) await Ride.deleteOne({ _id: testRide._id });
    if (testRequest) await RideRequest.deleteOne({ _id: testRequest._id });
    // Keep booking for manual check if needed, but usually we delete
    if (testPassenger) await Booking.deleteMany({ passenger_id: testPassenger._id });
    if (testPassenger) await Wallet.deleteMany({ user_id: testPassenger._id });
    if (testDriver) await Wallet.deleteMany({ user_id: testDriver._id });
    if (testPassenger) await Transaction.deleteMany({ user_id: testPassenger._id });
    if (testDriver) await Transaction.deleteMany({ user_id: testDriver._id });
    
    console.log('✅ Cleanup finished.');
    mongoose.connection.close();
    process.exit(0);
  }
}

testCancellationFlow();
