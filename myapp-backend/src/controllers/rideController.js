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

      const filter = {
        airport_id,
        status: "active",
        datetime_start: { $gt: new Date() },
      };

      if (direction) filter.direction = direction;
      if (home_postcode) filter.home_postcode = home_postcode;
      if (seats_min) filter.seats_left = { $gte: parseInt(seats_min) };
      
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        filter.datetime_start = {
          $gte: startOfDay,
          $lte: endOfDay,
        };
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

      // Transform to match expected format
      const transformedRides = rides.map((ride) => ({
        ...ride.toJSON(),
        driver_first_name: ride.driver_id?.first_name,
        driver_last_name: ride.driver_id?.last_name,
        driver_avatar: ride.driver_id?.avatar_url,
        airport_name: ride.airport_id?.name,
        airport_code: ride.airport_id?.iata_code,
      }));

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
      const ride = await Ride.findById(id)
        .populate("driver_id", "first_name last_name phone avatar_url")
        .populate("airport_id", "name iata_code city");

      if (!ride) {
        return res.status(404).json({
          success: false,
          message: "Ride not found",
        });
      }

      // Transform to match expected format
      const transformedRide = {
        ...ride.toJSON(),
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

      // Transform to match expected format
      const transformedRides = rides.map((ride) => ({
        ...ride.toJSON(),
        airport_name: ride.airport_id?.name,
        airport_code: ride.airport_id?.iata_code,
      }));

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
