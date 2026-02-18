const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");

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
      return this._processStripeRefund(booking, ride, driverId, reason, options);
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
  static async _processStripeRefund(booking, ride, driverId, reason, options) {
    try {
      console.log(`[RefundService] processing STRIPE refund for PI: ${booking.payment_intent_id}`);
      
      const refundParams = {
        payment_intent: booking.payment_intent_id,
        metadata: {
            reason: reason,
            bookingId: booking._id.toString()
        }
      };

      // Check for connected account transfer
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
        if (paymentIntent.transfer_data?.destination) {
          refundParams.reverse_transfer = true;
          refundParams.refund_application_fee = true;
          console.log(`[RefundService] Reversing transfer to ${paymentIntent.transfer_data.destination}`);
        }
      } catch (err) {
        console.error(`[RefundService] Failed to retrieve PI ${booking.payment_intent_id}:`, err.message);
      }

      const refund = await stripe.refunds.create(refundParams);
      console.log(`[RefundService] Stripe refund created: ${refund.id}`);

      // If driver was credited via INTERNAL WALLET (no Stripe Connect), we must deduct from their wallet
      const driver = await User.findById(driverId);
      if (!driver?.stripeAccountId) {
        await this._deductFromDriverWallet(driverId, booking, ride, "Stripe Refund", reason);
      }

      // Update booking
      booking.payment_status = "refunded";
      booking.refund_id = refund.id;
      booking.refunded_at = new Date();
      booking.refund_reason = reason;
      await booking.save();

      return { success: true, refundId: refund.id };

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

      const totalAmount = Math.round(ride.price_per_seat * booking.seats * 100);
      
      // 1. Deduct from Driver
      await this._deductFromDriverWallet(driverId, booking, ride, "Wallet Refund", reason);

      // 2. Credit Passenger
      const passengerWallet = await Wallet.getOrCreateWallet(passengerId);
      passengerWallet.balance += totalAmount;
      await passengerWallet.save();

      await Transaction.create({
        wallet_id: passengerWallet._id,
        user_id: passengerId,
        type: "refund",
        amount: totalAmount,
        gross_amount: totalAmount,
        fee_amount: 0,
        fee_percentage: 0,
        net_amount: totalAmount,
        currency: "EUR",
        status: "completed",
        reference_type: "booking",
        reference_id: booking._id,
        description: `Refund - ${reason}`,
        processed_at: new Date(),
      });

      // Update Booking
      booking.payment_status = "refunded";
      booking.refunded_at = new Date();
      booking.refund_reason = reason;
      await booking.save();

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

        if (driverWallet.balance >= driverEarnings) {
            driverWallet.balance -= driverEarnings;
            driverWallet.total_earned -= driverEarnings;
            await driverWallet.save();

            await Transaction.create({
                wallet_id: driverWallet._id,
                user_id: driverId,
                type: "refund",
                amount: -driverEarnings,
                gross_amount: grossAmount,
                fee_amount: 0,
                fee_percentage: 0,
                net_amount: driverEarnings,
                currency: "EUR",
                status: "completed",
                reference_type: "booking",
                reference_id: booking._id,
                stripe_payment_intent_id: booking.payment_intent_id,
                description: `Driver earnings reversed - ${reason}`,
                processed_at: new Date(),
            });
            console.log(`[RefundService] Deducted ${driverEarnings} from driver ${driverId}`);
        } else {
            console.warn(`[RefundService] Driver ${driverId} has insufficient funds to reverse ${driverEarnings}. Balance: ${driverWallet.balance}`);
            // We log this but don't stop the passenger refund logic generally, 
            // unless strict platform policy requires it. 
            // For now, we proceed but log heavily.
        }
    } catch (err) {
        console.error(`[RefundService] Failed to deduct from driver wallet:`, err);
    }
  }
}

module.exports = RefundService;
