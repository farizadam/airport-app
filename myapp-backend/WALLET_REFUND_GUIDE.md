# Wallet Refund Logic - Implementation Guide

## Overview

This document explains the wallet refund logic for ride cancellations in the covouturage app.

### Refund Logic Summary

When a **driver cancels a ride** with wallet payment:
- ✅ **Passenger**: Gets **FULL refund (100%)** - No fee deduction
- ✅ **Driver**: Gets **earning deducted** (loses their share of the platform fee)
- ✅ **Transaction Records**: Created for both parties for audit trail

### Example
- Passenger pays: €50 (wallet)
- Platform fee: 10% = €5
- Driver earnings: €45

**When Driver Cancels:**
- Passenger refunded: **€50** (full amount, no fees)
- Driver debited: **€45** (their earnings are reversed)
- Platform keeps: €5 fee (already taken during payment)

## Implementation Details

### Files Updated

1. **rideController.js** - Ride cancellation refunds
   - Enhanced logic to handle legacy bookings without `payment_method` field
   - Now checks: `booking.payment_method === "wallet" || (!booking.payment_method && !booking.payment_intent_id)`

2. **bookingController.js** - Booking cancellation refunds
   - Same enhancement for passenger-initiated cancellations
   - Ensures legacy wallet payments are properly refunded

### Migration Scripts

#### 1. Verify Pending Refunds (Safe - Read Only)
```bash
cd myapp-backend
node scripts/verify_wallet_refunds.js
```

**Output shows:**
- Count of bookings needing refunds
- Passenger names and refund amounts
- Driver debit amounts
- Total calculations

#### 2. Process Wallet Refunds (Executes Changes)
```bash
cd myapp-backend
node scripts/process_wallet_refunds.js
```

**This script will:**
- Find all cancelled bookings with wallet payments
- Refund passenger wallets with FULL amount
- Deduct driver earnings from driver wallets
- Create transaction records for both parties
- Update booking status to "refunded"
- Process in batches to avoid memory issues

### How to Use

#### For Past Transactions (Retroactive Processing)

1. **First, check what will be processed:**
   ```bash
   node scripts/verify_wallet_refunds.js
   ```
   Review the output carefully to ensure the amounts are correct.

2. **Create a backup (optional but recommended):**
   ```bash
   # Export your bookings collection
   mongodump --uri "your_mongodb_uri" --collection bookings
   ```

3. **Run the migration:**
   ```bash
   node scripts/process_wallet_refunds.js
   ```

4. **Verify results:**
   ```bash
   node scripts/verify_wallet_refunds.js
   ```
   Should now return "No bookings need wallet refunds"

#### For New/Future Transactions

The refund logic is now automatically handled in the ride and booking cancellation endpoints:

- **Driver cancels ride**: `DELETE /api/v1/rides/:id`
  - Triggers `RideController.cancel()`
  - Processes refunds for all passenger bookings

- **Passenger cancels booking**: `PATCH /api/v1/bookings/:id`
  - Triggers `BookingController.updateBooking()`
  - Processes refund for that specific booking

### Database Updates

The migration scripts update:
1. **Wallet documents** - Passenger and driver wallet balances
2. **Booking documents** - Status changed to "refunded", fields set:
   - `payment_status: "refunded"`
   - `refunded_at: <timestamp>`
   - `refund_reason: "ride_cancelled"`
   - `payment_method: "wallet"` (if not already set)
3. **Transaction records** - Created for audit trail

### Transaction Records Created

For each wallet refund, two transaction records are created:

**Passenger Refund Transaction:**
```javascript
{
  type: "refund",
  amount: totalAmount,           // Full refund amount (positive)
  user_id: passengerId,
  description: "Full refund - driver cancelled ride"
}
```

**Driver Debit Transaction:**
```javascript
{
  type: "refund",
  amount: -driverEarnings,       // Negative (debit)
  user_id: driverId,
  description: "Driver earnings reversed - driver cancelled ride"
}
```

### Monitoring

After processing, you can verify in the database:

```javascript
// Check passenger's new balance
db.wallets.findOne({ user_id: passengerId })

// Check driver's new balance
db.wallets.findOne({ user_id: driverId })

// Check transaction records
db.transactions.find({ reference_type: "booking", reference_id: bookingId })
```

### Troubleshooting

#### Issue: "Driver wallet has insufficient balance"

If the driver's wallet doesn't have enough balance to debit:
- The passenger refund still goes through ✓
- The driver debit is skipped ⚠️
- Manual intervention may be needed
- Check logs in script output

#### Issue: Bookings not being processed

The scripts look for bookings matching:
- Status: "cancelled"
- Payment status: "paid"
- AND one of:
  - Has `payment_method: "wallet"`, OR
  - Missing `payment_intent_id` (legacy booking)

If a booking doesn't match, it won't be processed. Verify booking data in MongoDB.

#### Issue: Script hangs

The script processes in batches of 10 bookings. If it hangs:
1. Stop the script (Ctrl+C)
2. Check MongoDB connection
3. Reduce BATCH_SIZE in script
4. Run again

## API Changes

No API changes required. The endpoints remain the same:
- `DELETE /api/v1/rides/:id` (cancel ride)
- `PATCH /api/v1/bookings/:id` (update booking status)

The logic improvements are internal and handle both new and legacy data automatically.

## Testing

To test the refund logic in development:

1. Create a test booking with wallet payment
2. Cancel the ride as driver
3. Verify:
   - Passenger wallet balance increased
   - Driver wallet balance decreased
   - Transaction records created
   - Booking marked as refunded

## Important Notes

⚠️ **Security & Data Integrity:**
- Always test in staging first
- Create backups before running migration
- The migration is idempotent (can be run multiple times safely)
- Check logs for any errors

💡 **Performance:**
- Migration processes in batches to avoid memory issues
- Large datasets (1000+ bookings) may take several minutes
- No production downtime required

📋 **Audit Trail:**
- All refunds create transaction records
- All updates are traceable in booking history
- Transaction description indicates "retroactive processing" for migrated refunds
