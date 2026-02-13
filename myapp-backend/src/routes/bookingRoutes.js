const express = require("express");
const BookingController = require("../controllers/bookingController");
const authMiddleware = require("../middleware/auth");
const { validate, validationRules, Joi } = require("../middleware/validation");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schemas
const createBookingSchema = Joi.object({
  seats: validationRules.positiveInt,
});

const updateBookingSchema = Joi.object({
  status: Joi.string().valid("accepted", "rejected", "cancelled").required(),
});

// Routes
router.post(
  "/rides/:rideId/bookings",
  validate(createBookingSchema),
  BookingController.create
);
router.get("/me/bookings", BookingController.getMyBookings);
// Alias for frontend compatibility
router.get("/my-bookings", BookingController.getMyBookings);
router.patch(
  "/bookings/:id",
  validate(updateBookingSchema),
  BookingController.updateStatus
);

module.exports = router;
