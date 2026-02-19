const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const NotificationService = require("./notificationService");

/**
 * Service to handle refunds centralized in one place
 */
class RefundService {
  /**
   * Process a refund for a booking
   * @param {Object} booking - The booking document (should be populated with ride_id)
   * @param {string} reason - The reason for the refund
   * @param {Object} options - Additional options (e.g., reversing application fee)
   */
  static async processRefund(booking, reason = "requested_by_user", options = {}) {
    console.log(`[RefundService] Processing refund for booking ${booking._id}, Reason: ${reason}`);

    if (booking.payment_status !== "paid") {
      console.warn(`[RefundService] Booking ${booking._id} is not 'paid' (status: ${booking.payment_status}). Skipping refund.`);
      return { success: false, message: "Booking not paid" };
    }

    // Ensure ride is populated or fetch it
    let ride = booking.ride_id;
    if (!ride || !ride.driver_id) {
        const Ride = require("../models/Ride"); // Lazy load to avoid circular deps
        ride = await Ride.findById(booking.ride_id).populate("driver_id");
    }

    if (!ride) {
        throw new Error("Ride not found for booking");
    }

    const driverId = ride.driver_id._id ? ride.driver_id._id.toString() : ride.driver_id.toString();
    const passengerId = booking.passenger_id._id 
      ? booking.passenger_id._id.toString() 
      : booking.passenger_id.toString();

    // 1. STRIPE CARD REFUND
    if (booking.payment_method === "card" && booking.payment_intent_id) {
      return this._processStripeRefund(booking, ride, driverId, passengerId, reason, options);
    }
    
    // 2. WALLET REFUND
    if (booking.payment_method === "wallet") {
      return this._processWalletRefund(booking, ride, driverId, passengerId, reason);
    }

    console.warn(`[RefundService] Unknown payment method: ${booking.payment_method}`);
    return { success: false, message: "Unknown payment method" };
  }

  /**
   * Internal: Handle Stripe Refund
   */
  static async _processStripeRefund(booking, ride, driverId, passengerId, reason, options) {
    try {
      console.log(`[RefundService] Step 1: Stripe PI: ${booking.payment_intent_id}`);
      const feePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
      const grossAmount = ride.price_per_seat * booking.seats * 100;
      const driverEarnings = Math.round(grossAmount * ((100 - feePercentage) / 100));
      console.log(`[RefundService] Step 2: Driver Earnings: ${driverEarnings}`);

      // 1. Reverse the Stripe transfer if it exists
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        if (paymentIntent.transfer_data?.destination) {
           await stripe.transfers.createReversal(paymentIntent.transfer_group, {
             amount: driverEarnings
           });
           console.log(`[RefundService] Reversed Stripe transfer`);
        }
      } catch (err) {
        console.warn(`[RefundService] Stripe reversal warning: ${err.message}`);
      }
      
      // 2. Take app-money back from driver
      console.log(`[RefundService] Step 3: Deducting from driver ${driverId}`);
      const driver = await User.findById(driverId);
      if (!driver?.stripeAccountId) {
        await this._deductFromDriverWallet(driverId, booking, ride, "Card Payment Refunded to Wallet", reason);
      }
      console.log(`[RefundService] Step 4: Driver deduction complete`);

      // 3. CREDIT PASSENGER WALLET 
      console.log(`[RefundService] Step 5: Crediting passenger ${passengerId}`);
      const passengerWallet = await Wallet.getOrCreateWallet(passengerId);
      console.log(`[RefundService] Step 6: Passenger wallet found: ${passengerWallet._id}`);
      passengerWallet.balance += driverEarnings;
      await passengerWallet.save();
      console.log(`[RefundService] Step 7: Passenger wallet saved. New balance: ${passengerWallet.balance}`);

      // Create a transaction record for the passenger
      const transaction = await Transaction.create({
        wallet_id: passengerWallet._id,
        user_id: passengerId,
        type: "refund",
        amount: driverEarnings,
        gross_amount: grossAmount,
        fee_amount: grossAmount - driverEarnings,
        fee_percentage: feePercentage,
        net_amount: driverEarnings,
        currency: "EUR",
        status: "completed",
        reference_type: "booking",
        reference_id: booking._id,
        stripe_payment_intent_id: booking.payment_intent_id,
        description: `Refund to Wallet from Card - ${reason} (Platform fees deducted)`,
        processed_at: new Date(),
      });
      console.log(`[RefundService] Step 8: Passenger transaction created: ${transaction._id}`);

      // Notify Passenger
      await NotificationService.notifyWalletUpdate(passengerId, {
        amount: driverEarnings / 100,
        currency: "EUR",
        type: "credit",
        message: `Refund of €${(driverEarnings / 100).toFixed(2)} added to your app wallet (Platform fees are non-refundable)`,
        transaction_id: transaction._id,
      });
      console.log(`[RefundService] Step 9: Notification sent to passenger`);

      return { success: true, transactionId: transaction._id };

    } catch (error) {
      console.error(`[RefundService] Stripe refund failed:`, error);
      throw error;
    }
  }

  /**
   * Internal: Handle Wallet Refund
   */
  static async _processWalletRefund(booking, ride, driverId, passengerId, reason) {
    try {
      console.log(`[RefundService] processing WALLET refund`);

      const feePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
      const grossAmount = ride.price_per_seat * booking.seats * 100;
      const driverEarnings = Math.round(grossAmount * ((100 - feePercentage) / 100));
      
      // 1. Deduct from Driver
      await this._deductFromDriverWallet(driverId, booking, ride, "Wallet Refund", reason);

      // 2. Credit Passenger (Only refund the portion driver got, fees stay with platform)
      const passengerWallet = await Wallet.getOrCreateWallet(passengerId);
      passengerWallet.balance += driverEarnings;
      await passengerWallet.save();

      const transaction = await Transaction.create({
        wallet_id: passengerWallet._id,
        user_id: passengerId,
        type: "refund",
        amount: driverEarnings,
        gross_amount: grossAmount,
        fee_amount: grossAmount - driverEarnings,
        fee_percentage: feePercentage,
        net_amount: driverEarnings,
        currency: "EUR",
        status: "completed",
        reference_type: "booking",
        reference_id: booking._id,
        description: `Refund - ${reason} (Platform fees deducted)`,
        processed_at: new Date(),
      });

      // Notify Passenger
      await NotificationService.notifyWalletUpdate(passengerId, {
        amount: driverEarnings / 100,
        currency: "EUR",
        type: "credit",
        message: `Refund of €${(driverEarnings / 100).toFixed(2)} received (Platform fees are non-refundable)`,
        transaction_id: transaction._id,
      });

      // Update Booking
      booking.payment_status = "refunded";
      booking.refunded_at = new Date();
      booking.refund_reason = reason;
      if (typeof booking.save === 'function') {
        await booking.save();
      }

      return { success: true };

    } catch (error) {
      console.error(`[RefundService] Wallet refund failed:`, error);
      throw error;
    }
  }

  /**
   * Helper: Deduct funds from driver wallet (if they were credited there)
   */
  static async _deductFromDriverWallet(driverId, booking, ride, type, reason) {
    try {
        const driverWallet = await Wallet.getOrCreateWallet(driverId);
        const feePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
        const grossAmount = ride.price_per_seat * booking.seats * 100;
        const driverEarnings = Math.round(grossAmount * ((100 - feePercentage) / 100));

        // Always deduct from driver, even if balance goes negative (debt)
        driverWallet.balance -= driverEarnings;
        driverWallet.total_earned -= driverEarnings;
        await driverWallet.save();

        const transaction = await Transaction.create({
            wallet_id: driverWallet._id,
            user_id: driverId,
            type: "refund",
            amount: -driverEarnings,
            gross_amount: grossAmount,
            fee_amount: 0,
            fee_percentage: 0,
            net_amount: -driverEarnings,
            currency: "EUR",
            status: "completed",
            reference_type: "booking",
            reference_id: booking._id,
            stripe_payment_intent_id: booking.payment_intent_id,
            description: `Driver earnings reversed - ${reason}`,
            processed_at: new Date(),
        });
        console.log(`[RefundService] Deducted ${driverEarnings} from driver ${driverId}`);
        
        // Notify Driver
        await NotificationService.notifyWalletUpdate(driverId, {
            amount: driverEarnings / 100,
            currency: "EUR",
            type: "debit",
            message: `Booking cancelled. €${(driverEarnings / 100).toFixed(2)} deducted from wallet`,
            transaction_id: transaction._id,
        });
    } catch (err) {
        console.error(`[RefundService] Failed to deduct from driver wallet:`, err);
    }
  }

  /**
   * Process refund specifically for a RideRequest (e.g., when no official booking exists yet)
   * @param {Object} request - The RideRequest document (populated with passenger and matched_driver)
   * @param {string} reason - The reason for the refund
   */
  static async processRideRequestRefund(request, reason = "passenger_cancelled") {
    console.log(`[RefundService] Processing request-only refund for request ${request._id}`);

    if (request.payment_status !== "paid") {
      return { success: false, message: "Request not paid" };
    }

    const passengerId = request.passenger._id || request.passenger;
    const driverId = request.matched_driver?._id || request.matched_driver;

    if (!driverId) {
      throw new Error("No matched driver found for request refund");
    }

    // Find the accepted offer to get the price
    const acceptedOffer = request.offers.find(o => o.status === "accepted");
    if (!acceptedOffer) {
      throw new Error("No accepted offer found to determine refund price");
    }

    const pricePerSeat = acceptedOffer.price_per_seat;
    const seats = request.seats_needed || 1;
    const grossAmount = Math.round(pricePerSeat * seats * 100);

    // Create a "mock" ride object for calculations (or just pass values)
    const mockRide = { price_per_seat: pricePerSeat };
    const mockBooking = { 
        _id: request._id, 
        seats: seats, 
        payment_method: acceptedOffer.payment_method,
        payment_intent_id: acceptedOffer.payment_intent_id 
    };

    if (acceptedOffer.payment_method === "wallet") {
      return this._processWalletRefund(mockBooking, mockRide, driverId, passengerId, reason);
    } else if (acceptedOffer.payment_method === "card" && acceptedOffer.payment_intent_id) {
      // Implement standalone card refund
      return this._processStripeRefund(mockBooking, mockRide, driverId, passengerId, reason, {});
    } else {
      return { success: false, message: "Refund mismatch: method or intent missing" };
    }
  }
}

module.exports = RefundService;
