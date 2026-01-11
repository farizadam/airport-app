const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const Airport = require("../models/Airport");
const Booking = require("../models/Booking");
const NotificationService = require("../services/notificationService");

class RideController {
  /**
   * Create a new ride
   * POST /api/v1/rides
   */
  static async create(req, res, next) {
    try {
      const driverId = req.user.id;
      const rideData = { ...req.validatedBody, driver_id: driverId };

      // Verify user role
      if (req.user.role === "passenger") {
        return res.status(403).json({
          success: false,
          message: "Only drivers can create rides",
        });
      }

      // Verify airport exists
      const airport = await Airport.findById(rideData.airport_id);
      if (!airport) {
        return res.status(404).json({
          success: false,
          message: "Airport not found",
        });
      }

      // Validate datetime is in the future
      const rideDate = new Date(rideData.datetime_start);
      if (rideDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Ride date must be in the future",
        });
      }

      // Set seats_left equal to seats_total
      rideData.seats_left = rideData.seats_total;

      const ride = await Ride.create(rideData);

      res.status(201).json({
        success: true,
        message: "Ride created successfully",
        data: ride,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search rides
   * GET /api/v1/rides
   */
  static async search(req, res, next) {
    try {
      const {
        airport_id,
        direction,
        date,
        home_postcode,
        seats_min,
        page = 1,
        limit = 20,
      } = req.query;

      if (!airport_id) {
        return res.status(400).json({
          success: false,
          message: "airport_id is required",
        });
      }

      console.log("Search Query Params:", req.query);

      // Map frontend direction values to database values
      let mappedDirection = direction;
      if (direction === "to_airport") {
        mappedDirection = "home_to_airport";
      } else if (direction === "from_airport") {
        mappedDirection = "airport_to_home";
      }

      const filter = {
        airport_id,
        status: "active",
      };

      if (mappedDirection) filter.direction = mappedDirection;
      // Remove postcode filter for date-based searches
      if (home_postcode && !date) filter.home_postcode = home_postcode;
      if (seats_min) filter.seats_left = { $gte: parseInt(seats_min) };

      if (date) {
        // If date is provided, search for rides on that specific date (ignoring hours)
        const startOfDay = new Date(date);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setUTCHours(23, 59, 59, 999);
        console.log("Date range:", { startOfDay, endOfDay });
        filter.datetime_start = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
      } else {
        // Only apply future check when no specific date is provided
        filter.datetime_start = { $gt: new Date() };
      }

      console.log("Filter being used:", JSON.stringify(filter, null, 2));

      // Debug: Check rides without direction filter
      const debugFilter = { ...filter };
      delete debugFilter.direction;
      const allRidesForDate = await Ride.find(debugFilter);
      console.log(
        `Debug: Found ${allRidesForDate.length} rides without direction filter`
      );
      if (allRidesForDate.length > 0) {
        console.log(
          "Sample ride directions:",
          allRidesForDate.map((r) => ({ id: r._id, direction: r.direction }))
        );
      }

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const skip = (pageNum - 1) * limitNum;

      const rides = await Ride.find(filter)
        .populate("driver_id", "first_name last_name avatar_url")
        .populate("airport_id", "name iata_code city")
        .sort({ datetime_start: 1 })
        .limit(limitNum)
        .skip(skip);

      console.log(`Found ${rides.length} rides`);

      // Transform to match expected format
      const transformedRides = rides.map((ride) => {
        // Map direction back to frontend format
        let frontendDirection = ride.direction;
        if (ride.direction === "home_to_airport") {
          frontendDirection = "to_airport";
        } else if (ride.direction === "airport_to_home") {
          frontendDirection = "from_airport";
        }

        return {
          ...ride.toJSON(),
          id: ride._id.toString(),
          departure_datetime: ride.datetime_start,
          direction: frontendDirection,
          available_seats: ride.seats_left,
          driver: {
            first_name: ride.driver_id?.first_name,
            last_name: ride.driver_id?.last_name,
            avatar_url: ride.driver_id?.avatar_url,
          },
          airport: {
            name: ride.airport_id?.name,
            code: ride.airport_id?.iata_code,
            city: ride.airport_id?.city,
          },
          driver_comment: ride.comment,
          // Keep backward compatibility
          driver_first_name: ride.driver_id?.first_name,
          driver_last_name: ride.driver_id?.last_name,
          driver_avatar: ride.driver_id?.avatar_url,
          airport_name: ride.airport_id?.name,
          airport_code: ride.airport_id?.iata_code,
        };
      });

      console.log("Transformed rides:", transformedRides);

      res.status(200).json({
        success: true,
        data: transformedRides,
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: transformedRides.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ride by ID
   * GET /api/v1/rides/:id
   */
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      console.log("getById - Received ID:", id, "Type:", typeof id);
      console.log("getById - req.params:", req.params);

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ride ID format",
        });
      }

      const ride = await Ride.findById(id)
        .populate("driver_id", "first_name last_name phone avatar_url")
        .populate("airport_id", "name iata_code city");

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      // Map direction back to frontend format
      let frontendDirection = ride.direction;
      if (ride.direction === "home_to_airport") {
        frontendDirection = "to_airport";
      } else if (ride.direction === "airport_to_home") {
        frontendDirection = "from_airport";
      }

      // Get the original driver_id before it was populated
      const driverIdString =
        ride.driver_id?._id?.toString() || ride.driver_id?.toString();

      // Transform to match expected format
      const transformedRide = {
        ...ride.toJSON(),
        id: ride._id.toString(),
        driver_id: driverIdString, // Ensure driver_id is the string ID, not the populated object
        departure_datetime: ride.datetime_start,
        direction: frontendDirection,
        available_seats: ride.seats_left,
        driver: {
          first_name: ride.driver_id?.first_name,
          last_name: ride.driver_id?.last_name,
          phone_number: ride.driver_id?.phone,
          avatar_url: ride.driver_id?.avatar_url,
        },
        airport: {
          name: ride.airport_id?.name,
          code: ride.airport_id?.iata_code,
          city: ride.airport_id?.city,
        },
        driver_comment: ride.comment,
        driver_first_name: ride.driver_id?.first_name,
        driver_last_name: ride.driver_id?.last_name,
        driver_phone: ride.driver_id?.phone,
        driver_avatar: ride.driver_id?.avatar_url,
        airport_name: ride.airport_id?.name,
        airport_code: ride.airport_id?.iata_code,
        airport_city: ride.airport_id?.city,
      };

      res.status(200).json({
        success: true,
        data: transformedRide,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get driver's rides
   * GET /api/v1/me/rides
   */
  static async getMyRides(req, res, next) {
    try {
      const driverId = req.user.id;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 100);
      const skip = (pageNum - 1) * limitNum;

      const rides = await Ride.find({ driver_id: driverId })
        .populate("airport_id", "name iata_code")
        .sort({ datetime_start: -1 })
        .limit(limitNum)
        .skip(skip);

      // Enrich with booking info (pending + accepted) so driver sees requests
      const transformedRides = await Promise.all(
        rides.map(async (ride) => {
          // Map direction back to frontend format
          let frontendDirection = ride.direction;
          if (ride.direction === "home_to_airport") {
            frontendDirection = "to_airport";
          } else if (ride.direction === "airport_to_home") {
            frontendDirection = "from_airport";
          }

          // Fetch bookings for this ride
          const bookings = await Booking.find({ ride_id: ride._id })
            .populate("passenger_id", "first_name last_name phone avatar_url")
            .sort({ createdAt: -1 })
            .lean();

          const bookingSummaries = bookings.map((b) => ({
            id: b._id.toString(),
            status: b.status,
            seats: b.seats,
            passenger_first_name: b.passenger_id?.first_name,
            passenger_last_name: b.passenger_id?.last_name,
            passenger_phone: b.passenger_id?.phone,
            passenger_avatar: b.passenger_id?.avatar_url,
          }));

          const pending_count = bookings.filter(
            (b) => b.status === "pending"
          ).length;
          const accepted_count = bookings.filter(
            (b) => b.status === "accepted"
          ).length;

          return {
            ...ride.toJSON(),
            id: ride._id.toString(),
            departure_datetime: ride.datetime_start,
            direction: frontendDirection,
            available_seats: ride.seats_left,
            driver_comment: ride.comment,
            airport_name: ride.airport_id?.name,
            airport_code: ride.airport_id?.iata_code,
            bookings: bookingSummaries,
            pending_count,
            accepted_count,
          };
        })
      );

      res.status(200).json({
        success: true,
        data: transformedRides,
        pagination: {
          page: pageNum,
          limit: limitNum,
          count: transformedRides.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update ride
   * PATCH /api/v1/rides/:id
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const driverId = req.user.id;
      const updates = req.validatedBody;

      // Verify ride exists and user is the driver
      const existingRide = await Ride.findById(id);
      if (!existingRide) {
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      if (existingRide.driver_id.toString() !== driverId) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own rides",
        });
      }

      if (existingRide.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "Cannot update a cancelled or completed ride",
        });
      }

      const updatedRide = await Ride.findByIdAndUpdate(id, updates, {
        new: true,
        runValidators: true,
      });

      res.status(200).json({
        success: true,
        message: "Ride updated successfully",
        data: updatedRide,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel ride
   * DELETE /api/v1/rides/:id
   */
  static async cancel(req, res, next) {
    try {
      const { id } = req.params;
      const driverId = req.user.id;

      // Verify ride exists and user is the driver
      const existingRide = await Ride.findById(id).populate("airport_id");
      if (!existingRide) {
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      if (existingRide.driver_id.toString() !== driverId) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own rides",
        });
      }

      // Cancel the ride
      const cancelledRide = await Ride.findByIdAndUpdate(
        id,
        { status: "cancelled" },
        { new: true }
      );

      if (!cancelledRide) {
        return res.status(400).json({
          success: false,
          message: "Ride cannot be cancelled",
        });
      }

      // Cancel all associated bookings
      const result = await Booking.updateMany(
        { ride_id: id, status: { $in: ["pending", "accepted"] } },
        { status: "cancelled" }
      );

      // Get all affected bookings for notifications
      const affectedBookings = await Booking.find({
        ride_id: id,
        status: "cancelled",
      });

      // Notify all affected passengers
      for (const booking of affectedBookings) {
        await NotificationService.notifyRideCancelled(
          booking.passenger_id.toString(),
          {
            id: existingRide._id.toString(),
            airport_name: existingRide.airport_id?.name,
            datetime_start: existingRide.datetime_start,
          }
        );
      }

      res.status(200).json({
        success: true,
        message: "Ride cancelled successfully",
        data: {
          ride: cancelledRide,
          cancelled_bookings: result.modifiedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bookings for a ride (for driver)
   * GET /api/v1/rides/:id/bookings
   */
  static async getRideBookings(req, res, next) {
    try {
      const { id } = req.params;
      const driverId = req.user.id;

      // Verify ride exists and user is the driver
      const ride = await Ride.findById(id);
      if (!ride) {
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      if (ride.driver_id.toString() !== driverId) {
        return res.status(403).json({
          success: false,
          message: "You can only view bookings for your own rides",
        });
      }

      const bookings = await Booking.find({ ride_id: id })
        .populate("passenger_id", "first_name last_name phone avatar_url")
        .sort({ createdAt: -1 });

      // Transform to match expected format
      const transformedBookings = bookings.map((booking) => ({
        ...booking.toJSON(),
        passenger_first_name: booking.passenger_id?.first_name,
        passenger_last_name: booking.passenger_id?.last_name,
        passenger_phone: booking.passenger_id?.phone,
        passenger_avatar: booking.passenger_id?.avatar_url,
      }));

      res.status(200).json({
        success: true,
        data: transformedBookings,
        count: transformedBookings.length,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = RideController;
