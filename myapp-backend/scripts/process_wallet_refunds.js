#!/usr/bin/env node

/**
 * Migration Script: Process Wallet Refunds for Past Transactions
 * 
 * This script handles refunds for bookings that were cancelled but:
 * 1. Don't have payment_method field (legacy bookings)
 * 2. Were paid with wallet but not yet refunded
 * 3. Have been sitting in cancelled status without refund processing
 * 
 * Usage: node scripts/process_wallet_refunds.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Booking = require("../src/models/Booking");
const Ride = require("../src/models/Ride");
const Wallet = require("../src/models/Wallet");
const Transaction = require("../src/models/Transaction");

const BATCH_SIZE = 10; // Process in batches to avoid memory issues

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function identifyWalletBookings() {
  /**
   * Find all cancelled bookings that should have been wallet refunds
   * These are bookings that:
   * 1. Are cancelled
   * 2. Have payment_status = "paid" (means they were paid)
   * 3. Either:
   *    a) Have payment_method = "wallet", OR
   *    b) Don't have payment_intent_id (legacy wallet payment)
   * 4. Are not yet refunded (payment_status != "refunded")
   */
  const query = {
    status: "cancelled",
    payment_status: "paid",
    // Find bookings that are wallet payments
    $or: [
      { payment_method: "wallet" },  // Explicitly marked as wallet
      {
        // Legacy bookings: no payment_intent_id means it was wallet payment
        payment_intent_id: { $exists: false },
      },
      {
        // Also catch cases where payment_intent_id is null or empty string
        payment_intent_id: { $in: [null, ""] },
      },
    ],
  };

  return await Booking.find(query)
    .populate("ride_id", "price_per_seat driver_id datetime_start")
    .populate("passenger_id", "first_name last_name email")
    .sort({ createdAt: 1 });
}

async function processWalletRefund(booking) {
  const bookingId = booking._id.toString();
  const passengerId = booking.passenger_id._id.toString();
  const driverId = booking.ride_id.driver_id.toString();

  try {
    console.log(`\n📋 Processing booking ${bookingId}`);
    console.log(`   Passenger: ${booking.passenger_id.first_name} ${booking.passenger_id.last_name}`);
    console.log(`   Seats: ${booking.seats}`);

    const ride = await Ride.findById(booking.ride_id._id);
    if (!ride) {
      console.warn(`   ⚠️  Ride not found for booking ${bookingId}`);
      return { success: false, reason: "ride_not_found" };
    }

    const totalAmount = Math.round(ride.price_per_seat * booking.seats * 100);
    const feePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
    const driverEarnings = Math.round(totalAmount * ((100 - feePercentage) / 100));

    console.log(`   Amount to refund: €${(totalAmount / 100).toFixed(2)}`);
    console.log(`   Driver earnings to deduct: €${(driverEarnings / 100).toFixed(2)}`);

    // 1. Refund passenger's wallet with FULL amount
    const passengerWallet = await Wallet.getOrCreateWallet(passengerId);
    const oldBalance = passengerWallet.balance;
    passengerWallet.balance += totalAmount;
    await passengerWallet.save();
    console.log(`   ✓ Passenger wallet refunded: €${(oldBalance / 100).toFixed(2)} → €${(passengerWallet.balance / 100).toFixed(2)}`);

    // 2. Create refund transaction for passenger
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
      description: "Wallet refund - driver cancelled ride (retroactive processing)",
      processed_at: new Date(),
    });
    console.log(`   ✓ Transaction record created for passenger refund`);

    // 3. Deduct from driver's wallet
    const driverWallet = await Wallet.getOrCreateWallet(driverId);
    if (driverWallet.balance >= driverEarnings) {
      driverWallet.balance -= driverEarnings;
      driverWallet.total_earned -= driverEarnings;
      await driverWallet.save();
      console.log(`   ✓ Driver wallet debited: €${(driverEarnings / 100).toFixed(2)}`);

      // 4. Create transaction for driver
      await Transaction.create({
        wallet_id: driverWallet._id,
        user_id: driverId,
        type: "refund",
        amount: -driverEarnings,
        gross_amount: totalAmount,
        fee_amount: 0,
        fee_percentage: 0,
        net_amount: driverEarnings,
        currency: "EUR",
        status: "completed",
        reference_type: "booking",
        reference_id: booking._id,
        description: "Driver earnings reversed - ride cancelled (retroactive processing)",
        processed_at: new Date(),
      });
      console.log(`   ✓ Transaction record created for driver debit`);
    } else {
      console.warn(
        `   ⚠️  Driver wallet insufficient. Required: €${(driverEarnings / 100).toFixed(2)}, Available: €${(driverWallet.balance / 100).toFixed(2)}`
      );
      return { success: false, reason: "insufficient_driver_balance" };
    }

    // 5. Update booking status
    await Booking.findByIdAndUpdate(booking._id, {
      payment_status: "refunded",
      refunded_at: new Date(),
      refund_reason: "ride_cancelled",
      payment_method: "wallet", // Also ensure payment_method is set
    });
    console.log(`   ✓ Booking marked as refunded`);

    return { success: true };
  } catch (error) {
    console.error(`   ✗ Error processing booking ${bookingId}:`, error.message);
    return { success: false, reason: error.message };
  }
}

async function main() {
  await connectDB();

  console.log("\n🔍 Searching for wallet bookings that need refunds...\n");

  const walletBookings = await identifyWalletBookings();

  if (walletBookings.length === 0) {
    console.log("✓ No wallet bookings need refunds");
    console.log("\n✨ Migration complete!");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${walletBookings.length} bookings that need wallet refunds\n`);
  console.log("=".repeat(80));

  const results = {
    total: walletBookings.length,
    processed: 0,
    failed: 0,
    failures: [],
  };

  // Process in batches
  for (let i = 0; i < walletBookings.length; i += BATCH_SIZE) {
    const batch = walletBookings.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(walletBookings.length / BATCH_SIZE)}`);

    for (const booking of batch) {
      const result = await processWalletRefund(booking);
      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
        results.failures.push({
          bookingId: booking._id.toString(),
          reason: result.reason,
        });
      }
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 Migration Summary:");
  console.log(`   Total bookings processed: ${results.processed} ✓`);
  console.log(`   Failed: ${results.failed} ✗`);

  if (results.failures.length > 0) {
    console.log("\n⚠️  Failed bookings:");
    results.failures.forEach((failure) => {
      console.log(`   - ${failure.bookingId}: ${failure.reason}`);
    });
  }

  console.log("\n✨ Migration complete!");
  await mongoose.disconnect();
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
