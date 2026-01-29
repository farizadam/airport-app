const User = require("../models/User");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/v1/payments/create-intent
 * Body: { rideId, seats }
 * Auth: required
 *
 * Creates a PaymentIntent for a ride BEFORE creating booking.
 */
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { rideId, seats } = req.body;
    
    console.log("Payment intent request:", { userId, rideId, seats });
    
    if (!rideId || !seats) {
      return res.status(400).json({ 
        success: false, 
        message: "rideId and seats are required" 
      });
    }
    
    const ride = await Ride.findById(rideId).populate('driver_id');
    if (!ride) {
      return res.status(404).json({ 
        success: false, 
        message: "Ride not found" 
      });
    }
    
    console.log("Found ride:", ride._id);
    
    // Check if enough seats available
    if (ride.seats_left < seats) {
      return res.status(400).json({ 
        success: false, 
        message: `Only ${ride.seats_left} seats available` 
      });
    }
    
    const driver = ride.driver_id;
    console.log("Driver:", driver?._id, "Stripe Account:", driver?.stripeAccountId);
    
    // Calculate total price and platform fee
    const totalAmount = Math.round(ride.price_per_seat * seats * 100); // in cents
    const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
    const applicationFeeAmount = Math.round(totalAmount * (platformFeePercent / 100));
    
    console.log("Payment calculation:", {
      pricePerSeat: ride.price_per_seat,
      seats,
      totalAmount,
      platformFeePercent,
      applicationFeeAmount
    });
    
    let paymentIntentData = {
      amount: totalAmount,
      currency: "mad", // Moroccan Dirham
      payment_method_types: ["card"],
      metadata: {
        rideId: ride._id.toString(),
        passengerId: userId,
        driverId: driver?._id?.toString() || "",
        seats: seats.toString(),
      },
    };
    
    // Only add transfer_data if driver has Stripe account
    if (driver?.stripeAccountId) {
      paymentIntentData.application_fee_amount = applicationFeeAmount;
      paymentIntentData.transfer_data = {
        destination: driver.stripeAccountId,
      };
      console.log("Payment will be split with driver:", driver.stripeAccountId);
    } else {
      console.log("Driver has no Stripe account - payment goes to platform only");
    }
    
    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
    
    console.log("PaymentIntent created:", paymentIntent.id);
    
    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: totalAmount,
      currency: "MAD",
    });
  } catch (error) {
    console.error("Payment intent creation error:", error);
    next(error);
  }
};

/**
 * POST /api/v1/payments/complete
 * Body: { paymentIntentId, rideId, seats }
 * Auth: required
 *
 * Verifies payment and creates the booking after successful payment
 */
exports.completePayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { paymentIntentId, rideId, seats } = req.body;
    
    console.log("Complete payment request:", { userId, paymentIntentId, rideId, seats });
    
    if (!paymentIntentId || !rideId || !seats) {
      return res.status(400).json({ 
        success: false, 
        message: "paymentIntentId, rideId and seats are required" 
      });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: `Payment not completed. Status: ${paymentIntent.status}` 
      });
    }
    
    console.log("Payment verified:", paymentIntent.status);
    
    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ 
        success: false, 
        message: "Ride not found" 
      });
    }
    
    // Check seats again
    if (ride.seats_left < seats) {
      // Refund the payment since seats are no longer available
      await stripe.refunds.create({ payment_intent: paymentIntentId });
      return res.status(400).json({ 
        success: false, 
        message: "Seats no longer available. Payment refunded." 
      });
    }
    
    // Create the booking with status 'accepted' (already paid)
    const booking = await Booking.create({
      ride_id: rideId,
      passenger_id: userId,
      seats: seats,
      status: 'accepted', // Already paid, so automatically accepted
      payment_status: 'paid',
      payment_intent_id: paymentIntentId,
    });
    
    console.log("Booking created:", booking._id);
    
    // Update ride seats
    await Ride.findByIdAndUpdate(
      rideId,
      { $inc: { seats_left: -seats } },
      { new: true }
    );
    
    console.log(`Ride ${rideId} seats updated, removed ${seats} seats`);
    
    res.status(201).json({
      success: true,
      message: "Payment completed and booking confirmed!",
      booking: booking,
    });
  } catch (error) {
    console.error("Payment completion error:", error);
    next(error);
  }
};

/**
 * POST /api/v1/payments/ride
 * Body: { bookingId }
 * Auth: required
 *
 * Creates a PaymentIntent for a booking, splits payment between driver and platform.
 * (Legacy - for existing bookings)
 */
exports.createRidePayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.body;
    
    console.log("Payment request:", { userId, bookingId });
    
    if (!bookingId) {
      return res
        .status(400)
        .json({ success: false, message: "bookingId is required" });
    }
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.log("Booking not found:", bookingId);
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }
    
    console.log("Found booking:", booking);
    
    const ride = await Ride.findById(booking.ride_id);
    if (!ride) {
      console.log("Ride not found:", booking.ride_id);
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });
    }
    
    console.log("Found ride:", ride);
    
    const driver = await User.findById(ride.driver_id);
    if (!driver || !driver.stripeAccountId) {
      console.log("Driver issues:", { 
        driverId: ride.driver_id, 
        hasDriver: !!driver, 
        hasStripeAccount: driver?.stripeAccountId 
      });
      return res
        .status(400)
        .json({
          success: false,
          message: "Driver does not have a Stripe account",
        });
    }
    
    console.log("Driver stripe account:", driver.stripeAccountId);
    
    // Calculate total price and platform fee
    const totalAmount = Math.round(ride.price_per_seat * booking.seats * 100); // in cents
    const platformFeePercent = parseFloat(
      process.env.PLATFORM_FEE_PERCENT || "10",
    );
    const applicationFeeAmount = Math.round(
      totalAmount * (platformFeePercent / 100),
    );
    
    console.log("Payment calculation:", {
      pricePerSeat: ride.price_per_seat,
      seats: booking.seats,
      totalAmount,
      platformFeePercent,
      applicationFeeAmount
    });
    
    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: "eur",
      payment_method_types: ["card"],
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: driver.stripeAccountId,
      },
      metadata: {
        bookingId: booking._id.toString(),
        rideId: ride._id.toString(),
        passengerId: userId,
        driverId: driver._id.toString(),
      },
    });
    
    console.log("PaymentIntent created:", paymentIntent.id);
    
    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    next(error);
  }
};

/**
 * POST /api/v1/payments/confirm
 * Body: { paymentIntentId, bookingId }
 * Auth: required
 *
 * Confirms payment and updates booking status to accepted
 */
exports.confirmPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { paymentIntentId, bookingId } = req.body;
    
    console.log("Payment confirmation:", { userId, paymentIntentId, bookingId });
    
    if (!paymentIntentId || !bookingId) {
      return res.status(400).json({ 
        success: false, 
        message: "paymentIntentId and bookingId are required" 
      });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        success: false, 
        message: "Payment not completed" 
      });
    }
    
    // Find and update booking
    const booking = await Booking.findById(bookingId).populate('ride_id');
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: "Booking not found" 
      });
    }
    
    // Update booking status to accepted
    booking.status = 'accepted';
    await booking.save();
    
    // Update ride seats
    const ride = booking.ride_id;
    await Ride.findByIdAndUpdate(
      ride._id,
      { $inc: { seats_left: -booking.seats } },
      { new: true }
    );
    
    console.log(`Booking ${bookingId} confirmed and accepted after payment ${paymentIntentId}`);
    
    res.status(200).json({
      success: true,
      message: "Payment confirmed and booking accepted",
      booking: booking,
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);
    next(error);
  }
};
