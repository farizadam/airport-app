#!/usr/bin/env node

/**
 * Verification Script: Check Wallet Refunds Status
 * 
 * This script identifies bookings that need wallet refunds without making changes.
 * Run this FIRST to see what will be processed.
 * 
 * Usage: node scripts/verify_wallet_refunds.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Booking = require("../src/models/Booking");
const Ride = require("../src/models/Ride");
const User = require("../src/models/User");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

async function verifyWalletBookings() {
  console.log("\n🔍 Scanning for wallet bookings that need refunds...\n");

  const query = {
    status: "cancelled",
    payment_status: "paid",
    $or: [
      { payment_method: "wallet" },
      { payment_intent_id: { $exists: false } },
      { payment_intent_id: { $in: [null, ""] } },
    ],
  };

  const bookings = await Booking.find(query)
    .populate("ride_id")
    .populate("passenger_id")
    .sort({ createdAt: -1 });

  if (bookings.length === 0) {
    console.log("✓ No bookings need wallet refunds - everything looks good!");
    return;
  }

  console.log(`Found ${bookings.length} booking(s) that need wallet refunds:\n`);
  console.log("=".repeat(100));

  let totalRefundAmount = 0;
  let totalDriverDebit = 0;

  bookings.forEach((booking, index) => {
    const ride = booking.ride_id;
    const passenger = booking.passenger_id;
    const totalAmount = Math.round(ride.price_per_seat * booking.seats * 100);
    const feePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENT || "10");
    const driverEarnings = Math.round(totalAmount * ((100 - feePercentage) / 100));

    totalRefundAmount += totalAmount;
    totalDriverDebit += driverEarnings;

    console.log(`\n[${index + 1}] Booking ID: ${booking._id}`);
    console.log(`    Created: ${new Date(booking.createdAt).toLocaleString()}`);
    console.log(`    Cancelled: ${new Date(booking.updatedAt).toLocaleString()}`);
    console.log(`    Passenger: ${passenger.first_name} ${passenger.last_name} (${passenger.email})`);
    console.log(`    Seats: ${booking.seats}`);
    console.log(`    Refund Amount: €${(totalAmount / 100).toFixed(2)} (100%)`);
    console.log(`    Driver Debit: €${(driverEarnings / 100).toFixed(2)} (${100 - feePercentage}% of refund)`);
    console.log(`    Payment Method: ${booking.payment_method || "wallet (legacy)"}`);
  });

  console.log("\n" + "=".repeat(100));
  console.log("\n💰 TOTALS:");
  console.log(`   Total Passenger Refunds: €${(totalRefundAmount / 100).toFixed(2)}`);
  console.log(`   Total Driver Debits: €${(totalDriverDebit / 100).toFixed(2)}`);
  console.log(`   Platform Fees Recovered: €${((totalRefundAmount - totalDriverDebit) / 100).toFixed(2)}`);

  console.log("\n" + "=".repeat(100));
  console.log("\n📋 Next Steps:");
  console.log("   1. Review the bookings above carefully");
  console.log("   2. Run: node scripts/process_wallet_refunds.js");
  console.log("   3. Verify results with: node scripts/verify_wallet_refunds.js (should show 0 pending)");
}

async function main() {
  await connectDB();
  await verifyWalletBookings();
  await mongoose.disconnect();
  console.log("\n✓ Verification complete\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
