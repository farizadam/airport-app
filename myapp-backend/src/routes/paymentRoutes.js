const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// NEW: Create payment intent before booking
router.post("/create-intent", authMiddleware, paymentController.createPaymentIntent);

// NEW: Complete payment and create booking
router.post("/complete", authMiddleware, paymentController.completePayment);

// Legacy: Create payment for existing booking
router.post("/ride", authMiddleware, paymentController.createRidePayment);

// Legacy: Confirm payment and accept booking
router.post("/confirm", authMiddleware, paymentController.confirmPayment);

module.exports = router;
