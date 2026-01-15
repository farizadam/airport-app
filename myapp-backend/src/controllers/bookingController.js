const Booking = require("../models/Booking");
const Ride = require("../models/Ride");
const User = require("../models/User");
const NotificationService = require("../services/notificationService");
const mongoose = require("mongoose");

class BookingController {
  /**
   * Create a booking request
   * POST /api/v1/rides/:rideId/bookings
   */
  static async create(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { rideId } = req.params;
      const passengerId = req.user.id;
      const { seats } = req.validatedBody;

      // Get ride details
      const ride = await Ride.findById(rideId).session(session);

      if (!ride) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      // Validate ride status
      if (ride.status !== "active") {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "This ride is not available for booking",
        });
      }

      // Validate ride is in the future
      if (new Date(ride.datetime_start) <= new Date()) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Cannot book a ride in the past",
        });
      }

      // Cannot book own ride
      if (ride.driver_id.toString() === passengerId) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "You cannot book your own ride",
        });
      }

      // Check if already booked
      const alreadyBooked = await Booking.findOne({
        ride_id: rideId,
        passenger_id: passengerId,
      }).session(session);

      if (alreadyBooked) {
        await session.abortTransaction();
        return res.status(409).json({
          success: false,
          message: "You already have a booking for this ride",
        });
      }

      // Check available seats
      if (ride.seats_left < seats) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Only ${ride.seats_left} seat(s) available`,
        });
      }

      // Create booking
      const [booking] = await Booking.create(
        [
          {
            ride_id: rideId,
            passenger_id: passengerId,
            seats,
          },
        ],
        { session }
      );

      // Don't reserve seats yet - only reserve when accepted
      // This allows multiple pending requests

      await session.commitTransaction();

      // Get full booking details for notification
      const bookingWithDetails = await Booking.findById(booking._id)
        .populate("passenger_id", "first_name last_name phone avatar_url")
        .populate({
          path: "ride_id",
          populate: { path: "airport_id", select: "name iata_code" },
        });

      // Notify driver
      await NotificationService.notifyBookingRequest(
        ride.driver_id.toString(),
        {
          id: booking._id.toString(),
          ride_id: rideId,
          passenger_first_name: bookingWithDetails.passenger_id?.first_name,
          passenger_last_name: bookingWithDetails.passenger_id?.last_name,
          seats,
        }
      );

      res.status(201).json({
        success: true,
        message: "Booking request created successfully",
        data: booking,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  }

  /**
   * Get passenger's bookings
   * GET /api/v1/me/bookings
   */
  static async getMyBookings(req, res, next) {
    try {
      const passengerId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const skip = (pageNum - 1) * limitNum;

      const bookings = await Booking.find({ passenger_id: passengerId })
        .populate({
          path: "ride_id",
          populate: [
            { path: "driver_id", select: "first_name last_name phone" },
            { path: "airport_id", select: "name iata_code" },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip);

      // Transform to match expected format
      const transformedBookings = bookings.map((booking) => ({
        ...booking.toJSON(),
        datetime_start: booking.ride_id?.datetime_start,
        direction: booking.ride_id?.direction,
        home_city: booking.ride_id?.home_city,
        price_per_seat: booking.ride_id?.price_per_seat,
        ride_status: booking.ride_id?.status,
        driver_first_name: booking.ride_id?.driver_id?.first_name,
        driver_last_name: booking.ride_id?.driver_id?.last_name,
        driver_phone: booking.ride_id?.driver_id?.phone,
        airport_name: booking.ride_id?.airport_id?.name,
        airport_code: booking.ride_id?.airport_id?.iata_code,
      }));

      res.status(200).json({
        success: true,
        data: transformedBookings,
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: transformedBookings.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update booking status (accept/reject/cancel)
   * PATCH /api/v1/bookings/:id
   */
  static async updateStatus(req, res, next) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { status } = req.validatedBody;

      // Get booking details
      const booking = await Booking.findById(id)
        .populate({
          path: "ride_id",
          populate: { path: "airport_id" },
        })
        .session(session);

      if (!booking) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      const isDriver = booking.ride_id.driver_id.toString() === userId;
      const isPassenger = booking.passenger_id.toString() === userId;

      // Validate permissions
      if (!isDriver && !isPassenger) {
        await session.abortTransaction();
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify this booking",
        });
      }

      // Validate status transitions
      if (status === "accepted" || status === "rejected") {
        if (!isDriver) {
          await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: "Only the driver can accept or reject bookings",
          });
        }

        if (booking.status !== "pending") {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Can only accept/reject pending bookings",
          });
        }
      }

      if (status === "cancelled") {
        if (!isPassenger) {
          await session.abortTransaction();
          return res.status(403).json({
            success: false,
            message: "Only the passenger can cancel their booking",
          });
        }

        if (!["pending", "accepted"].includes(booking.status)) {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Cannot cancel this booking",
          });
        }

        // Check if ride is too soon (e.g., less than 24 hours)
        const rideDate = new Date(booking.ride_id.datetime_start);
        const now = new Date();
        const hoursUntilRide = (rideDate - now) / (1000 * 60 * 60);

        if (hoursUntilRide < 24 && booking.status === "accepted") {
          await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: "Cannot cancel less than 24 hours before the ride",
          });
        }
      }

      // Store old status for seat calculation
      const oldStatus = booking.status;

      // Update booking status
      booking.status = status;
      await booking.save({ session });

      // Get the ride ID properly (handle both populated and non-populated cases)
      const rideId = booking.ride_id._id || booking.ride_id;
      console.log(
        "Updating seats for ride:",
        rideId,
        "Old status:",
        oldStatus,
        "New status:",
        status,
        "Seats:",
        booking.seats
      );

      // Update seats_left based on status change
      if (oldStatus === "pending" && status === "accepted") {
        // Decrease seats when a pending booking is accepted
        const updateResult = await Ride.findByIdAndUpdate(
          rideId,
          { $inc: { seats_left: -booking.seats } },
          { session, new: true }
        );
        console.log(
          "Seats decreased. New seats_left:",
          updateResult?.seats_left
        );
      } else if (
        oldStatus === "pending" &&
        (status === "rejected" || status === "cancelled")
      ) {
        // No seat change needed - seats weren't reserved for pending
        console.log("No seat change for rejected/cancelled pending booking");
      } else if (oldStatus === "accepted" && status === "cancelled") {
        // Release seats when an accepted booking is cancelled
        const updateResult = await Ride.findByIdAndUpdate(
          rideId,
          { $inc: { seats_left: booking.seats } },
          { session, new: true }
        );
        console.log(
          "Seats released. New seats_left:",
          updateResult?.seats_left
        );
      }

      await session.commitTransaction();

      // Send notifications
      if (status === "accepted") {
        const driver = await User.findById(booking.ride_id.driver_id);
        await NotificationService.notifyBookingAccepted(
          booking.passenger_id.toString(),
          {
            id: booking._id.toString(),
            ride_id: booking.ride_id._id.toString(),
            driver_first_name: driver?.first_name,
            driver_last_name: driver?.last_name,
          }
        );
      } else if (status === "rejected") {
        await NotificationService.notifyBookingRejected(
          booking.passenger_id.toString(),
          {
            id: booking._id.toString(),
            ride_id: booking.ride_id._id.toString(),
          }
        );
      } else if (status === "cancelled") {
        await NotificationService.notifyBookingCancelled(
          booking.ride_id.driver_id.toString(),
          {
            id: booking._id.toString(),
            ride_id: booking.ride_id._id.toString(),
          },
          true
        );
      }

      res.status(200).json({
        success: true,
        message: `Booking ${status} successfully`,
        data: booking,
      });
    } catch (error) {
      await session.abortTransaction();
      next(error);
    } finally {
      session.endSession();
    }
  }
}

module.exports = BookingController;
