const mongoose = require("mongoose");
const RideRequest = require("../models/RideRequest");
const Airport = require("../models/Airport");
const User = require("../models/User");
const Ride = require("../models/Ride");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const NotificationService = require("../services/notificationService");
const { safeGet, safeSetex, safeDel, safeKeys } = require("../config/redisClient");

/**
 * Release a booking and return seats/luggage to the ride (rollback after failed accept).
 */
async function releaseBookingAndSeats(booking) {
  if (!booking) return;
  await Ride.findByIdAndUpdate(booking.ride_id, {
    $inc: {
      seats_left: booking.seats,
      luggage_left: booking.luggage_count || 0,
    },
  });
  await Booking.deleteOne({ _id: booking._id });
}

// Create a new ride request (passenger)
exports.createRequest = async (req, res, next) => {
  try {
    const {
      airport_id,
      direction,
      location_address,
      location_city,
      location_postcode,
      location_latitude,
      location_longitude,
      preferred_datetime,
      time_flexibility,
      seats_needed,
      luggage_count,
      max_price_per_seat,
      notes,
    } = req.body;

    // Validate airport exists
    const airport = await Airport.findById(airport_id);
    if (!airport) {
      return res.status(404).json({ message: "Airport not found" });
    }

    // Set expiry to 1 hour AFTER preferred_datetime (gives drivers time to respond)
    const preferredDate = new Date(preferred_datetime);
    if (Number.isNaN(preferredDate.getTime())) {
      return res.status(400).json({ message: "Invalid preferred date/time" });
    }
    const expiresAt = new Date(preferredDate.getTime() + 60 * 60 * 1000); // +1 hour

    const request = await RideRequest.create({
      passenger: req.user.id,
      airport: airport_id,
      direction,
      location_address,
      location_city,
      location_latitude,
      location_longitude,
      location: {
        type: "Point",
        coordinates: [location_longitude, location_latitude],
      },
      preferred_datetime,
      seats_needed: seats_needed || 1,
      luggage_count: luggage_count || 1,
      max_price_per_seat,
      notes,
      expires_at: expiresAt,
    });

    await request.populate(["airport", "passenger"]);

    // Debug log
    console.log("[DEBUG] Created request:", {
      id: request._id,
      status: request.status,
      expires_at: request.expires_at,
      passenger: request.passenger?._id || request.passenger,
      preferred_datetime: request.preferred_datetime,
    });

    // Invalidate cache - remove all related cache keys using patterns
    const userRequestKeys = await safeKeys(`user_requests:${req.user.id}:*`);
    if (userRequestKeys.length > 0) {
      await safeDel(userRequestKeys);
    }
    const availableKeys = await safeKeys(`available_requests:*`);
    if (availableKeys.length > 0) {
      await safeDel(availableKeys);
    }

    res.status(201).json({
      message: "Ride request created successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};

// Update a ride request (passenger)
exports.updateRequest = async (req, res, next) => {
  try {
    const {
      airport_id,
      direction,
      location_address,
      location_city,
      location_postcode,
      location_latitude,
      location_longitude,
      preferred_datetime,
      time_flexibility,
      seats_needed,
      luggage_count,
      max_price_per_seat,
      notes,
    } = req.body;

    const request = await RideRequest.findOne({
      _id: req.params.id,
      passenger: req.user.id,
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Cannot update a request that is not pending" });
    }

    // Update fields
    if (airport_id) request.airport = airport_id;
    if (direction) request.direction = direction;
    if (location_address) request.location_address = location_address;
    if (location_city) request.location_city = location_city;
    if (location_postcode) request.location_postcode = location_postcode;
    if (location_latitude) request.location_latitude = location_latitude;
    if (location_longitude) request.location_longitude = location_longitude;
    if (location_latitude && location_longitude) {
      request.location = {
        type: "Point",
        coordinates: [location_longitude, location_latitude],
      };
    } else if (location_latitude && request.location_longitude) {
      request.location = {
        type: "Point",
        coordinates: [request.location_longitude, location_latitude],
      };
    } else if (location_longitude && request.location_latitude) {
      request.location = {
        type: "Point",
        coordinates: [location_longitude, request.location_latitude],
      };
    }
    if (preferred_datetime) request.preferred_datetime = preferred_datetime;
    if (time_flexibility) request.time_flexibility = time_flexibility;
    if (seats_needed) request.seats_needed = seats_needed;
    if (luggage_count !== undefined) request.luggage_count = luggage_count;
    if (max_price_per_seat !== undefined)
      request.max_price_per_seat = max_price_per_seat;
    if (notes !== undefined) request.notes = notes;

    await request.save();
    await request.populate(["airport", "passenger"]);

    res.json({
      message: "Request updated successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};

// Get all requests by current passenger
exports.getMyRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const cacheKey = `user_requests:${req.user.id}:${status || "all"}:${page}`;

    // Try cache first (safe – returns null when Redis is down)
    const cached = await safeGet(cacheKey);
    if (cached) {
      console.log("[CACHE HIT] getMyRequests");
      return res.json(JSON.parse(cached));
    }

    const query = { passenger: req.user.id };
    if (status) query.status = status;

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name phone avatar_url")
      .populate("matched_driver", "first_name last_name phone rating avatar_url")
      .populate("matched_ride")
      .populate("offers.driver", "first_name last_name phone rating avatar_url")
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RideRequest.countDocuments(query);

    const response = {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 5 minutes
    await safeSetex(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Get available requests for drivers (pending requests they can fulfill)
exports.getAvailableRequests = async (req, res, next) => {
  try {
    const {
      airport_id,
      direction,
      date,
      city,
      latitude,
      longitude,
      radius = 8000, // Default 8km radius (in meters)
      page = 1,
      limit = 10,
    } = req.query;

    console.log("[getAvailableRequests] Query params:", {
      airport_id,
      direction,
      date,
      city,
      latitude,
      longitude,
      radius,
    });

    const query = {
      status: "pending",
      expires_at: { $gt: new Date() },
      // Show all requests including user's own (they can see their requests in search results)
    };

    if (airport_id) query.airport = airport_id;
    if (direction) query.direction = direction;

    // Geospatial Search - find requests within radius of search location
    if (latitude && longitude) {
      console.log(
        `📍 Performing geospatial search for requests near [${latitude}, ${longitude}] with radius ${radius}m`,
      );
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(radius),
        },
      };
    } else if (city) {
      // Fallback to city text search only if no coordinates provided
      query.location_city = new RegExp(city, "i");
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.preferred_datetime = { $gte: startDate, $lte: endDate };
    }

    console.log(
      "[getAvailableRequests] Final query:",
      JSON.stringify(query, null, 2),
    );

    // Note: When using $near, MongoDB automatically sorts by distance
    // So we only add explicit sort when NOT using geospatial search
    let sortOption = { preferred_datetime: 1 };
    if (latitude && longitude) {
      sortOption = {}; // $near handles sorting by distance
    }

    // Create cache key based on search params
    const cacheKey = `available_requests:${airport_id}:${direction}:${date}:${city}:${page}`;

    // Try cache first (safe – returns null when Redis is down)
    const cached2 = await safeGet(cacheKey);
    if (cached2) {
      console.log("[CACHE HIT] getAvailableRequests");
      return res.json(JSON.parse(cached2));
    }

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name rating avatar_url")
      .populate("offers.driver", "_id")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    console.log("[getAvailableRequests] Found", requests.length, "requests");

    const total = await RideRequest.countDocuments(query);

    // Debug log
    console.log("[DEBUG] getAvailableRequests for user:", req.user.id);
    requests.forEach((r) => {
      console.log("[DEBUG] Available request:", {
        id: r._id,
        status: r.status,
        expires_at: r.expires_at,
        passenger: r.passenger?._id || r.passenger,
        preferred_datetime: r.preferred_datetime,
        location: r.location_city,
      });
    });

    // Add flag to indicate if current user has already made an offer
    const requestsWithOfferStatus = requests.map((request) => {
      const reqObj = request.toJSON();
      const hasOffered = reqObj.offers?.some(
        (o) =>
          o.driver?._id?.toString() === req.user.id ||
          o.driver?.toString() === req.user.id,
      );
      return {
        ...reqObj,
        has_user_offered: hasOffered,
      };
    });

    const response = {
      requests: requestsWithOfferStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 2 minutes
    await safeSetex(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Get driver's offers - requests where driver sent an offer or was matched
exports.getMyOffers = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const cacheKey = `driver_offers:${userId}:${status || "all"}:${page}`;

    // Try cache first (safe – returns null when Redis is down)
    const cached3 = await safeGet(cacheKey);
    if (cached3) {
      console.log("[CACHE HIT] getMyOffers");
      return res.json(JSON.parse(cached3));
    }

    // Find requests where this driver has made an offer or is matched
    let query = {
      $or: [{ "offers.driver": userId }, { matched_driver: userId }],
    };

    if (status === "pending") {
      query = {
        status: "pending",
        "offers.driver": userId,
      };
    } else if (status === "accepted") {
      query = {
        matched_driver: userId,
        status: "accepted",
      };
    } else if (status === "rejected") {
      // Requests where I made an offer but didn't get it: my offer was rejected or request cancelled/expired
      query = {
        "offers.driver": userId,
        $or: [
          { status: { $in: ["pending", "cancelled", "expired"] } },
          { status: "accepted", matched_driver: { $ne: userId } },
        ],
      };
    }

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name phone rating avatar_url")
      .populate("matched_driver", "first_name last_name phone rating avatar_url")
      .populate("offers.driver", "first_name last_name phone rating avatar_url")
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RideRequest.countDocuments(query);

    // Add driver's offer status to each request
    const requestsWithOfferInfo = requests.map((request) => {
      const reqObj = request.toJSON();
      const myOffer = reqObj.offers?.find(
        (o) =>
          o.driver?._id?.toString() === userId ||
          o.driver?.toString() === userId,
      );
      return {
        ...reqObj,
        my_offer: myOffer || null,
        is_matched: reqObj.matched_driver?._id?.toString() === userId,
      };
    });

    const response = {
      requests: requestsWithOfferInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Cache for 2 minutes
    await safeSetex(cacheKey, 120, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Get single request details
exports.getRequest = async (req, res, next) => {
  try {
    const request = await RideRequest.findById(req.params.id)
      .populate("airport")
      .populate("passenger", "first_name last_name phone rating avatar_url")
      .populate("matched_driver", "first_name last_name phone rating avatar_url")
      .populate("matched_ride")
      .populate("offers.driver", "first_name last_name phone rating avatar_url")
      .populate("offers.ride");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    res.json({ request });
  } catch (error) {
    next(error);
  }
};

// Driver makes an offer on a request
exports.makeOffer = async (req, res, next) => {
  try {
    const { price_per_seat, message, ride_id } = req.body;
    const requestId = req.params.id;

    const request = await RideRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Request is no longer available" });
    }

    // Check if driver already made an offer
    const existingOffer = request.offers.find(
      (o) => o.driver.toString() === req.user.id,
    );
    if (existingOffer) {
      return res
        .status(400)
        .json({ message: "You already made an offer on this request" });
    }

    // Verify ride belongs to driver if ride_id provided
    let ride = null;
    if (ride_id) {
      ride = await Ride.findOne({ _id: ride_id, driver_id: req.user.id });
      if (!ride) {
        return res.status(404).json({ message: "Ride not found or not yours" });
      }
    }

    request.offers.push({
      driver: req.user.id,
      ride: ride_id,
      price_per_seat,
      message,
      status: "pending",
    });

    await request.save();
    await request.populate(
      "offers.driver",
      "first_name last_name phone rating avatar_url",
    );

    // Get the newly added offer (last in array)
    const newOffer = request.offers[request.offers.length - 1];
    const driverInfo = newOffer.driver;

    // Notify passenger about the new offer (cache invalidation handled by NotificationService)
    try {
      await NotificationService.notifyOfferReceived(request.passenger.toString(), {
        request_id: request._id.toString(),
        offer_id: newOffer._id.toString(),
        driver_id: req.user.id,
        driver_name: `${driverInfo.first_name} ${driverInfo.last_name}`,
        price_per_seat: price_per_seat,
        message: message,
        ride_id: ride_id,
      });
      console.log("[makeOffer] Notification sent to passenger:", request.passenger);
    } catch (notifError) {
      console.error("[makeOffer] Failed to send notification:", notifError);
      // Don't fail the offer if notification fails
    }

    // Invalidate driver's offers cache
    const driverOfferKeys = await safeKeys(`driver_offers:${req.user.id}:*`);
    if (driverOfferKeys.length > 0) {
      await safeDel(driverOfferKeys);
    }
    // Also invalidate available requests cache since this request now has an offer
    const availableKeys2 = await safeKeys(`available_requests:*`);
    if (availableKeys2.length > 0) {
      await safeDel(availableKeys2);
    }

    res.json({
      message: "Offer sent successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reserve seats on a ride atomically and create a booking.
 * Returns the booking or throws if not enough seats/luggage.
 */
async function reserveRideSeatsAndCreateBooking(rideId, passengerId, seats, luggageCount, options = {}) {
  const luggage = Math.max(0, parseInt(luggageCount) || 0);
  const updateInc = { seats_left: -seats };
  if (luggage > 0) updateInc.luggage_left = -luggage;
  const filter = { _id: rideId, seats_left: { $gte: seats } };
  if (luggage > 0) filter.luggage_left = { $gte: luggage };
  const update = { $inc: updateInc };

  const ride = await Ride.findOneAndUpdate(filter, update, { new: true });
  if (!ride) {
    const r = await Ride.findById(rideId).select("seats_left luggage_left");
    const msg = r
      ? `Only ${r.seats_left} seat(s) and ${r.luggage_left || 0} luggage spot(s) available.`
      : "Ride not found.";
    const err = new Error(msg);
    err.code = "SEATS_UNAVAILABLE";
    throw err;
  }

  const bookingData = {
    ride_id: rideId,
    passenger_id: passengerId,
    seats,
    luggage_count: luggage,
    status: "accepted",
    payment_status: options.payment_status || "pending",
  };
  if (options.payment_method) bookingData.payment_method = options.payment_method;
  if (options.payment_intent_id) bookingData.payment_intent_id = options.payment_intent_id;

  const booking = await Booking.create(bookingData);
  return booking;
}

// Passenger accepts an offer (atomic update to prevent race when double-submit or concurrent accept)
exports.acceptOffer = async (req, res, next) => {
  try {
    const { offer_id } = req.body;
    const requestId = req.params.id;
    const userId = req.user.id;

    const request = await RideRequest.findOne({
      _id: requestId,
      passenger: userId,
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request is no longer pending" });
    }

    const offer = request.offers.id(offer_id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.status !== "pending") {
      return res.status(400).json({ message: "Offer is no longer pending" });
    }

    const rideId = offer.ride ? (offer.ride._id || offer.ride) : null;
    const seats = request.seats_needed || 1;
    const luggageCount = request.luggage_count || 0;
    let booking = null;

    if (rideId) {
      try {
        booking = await reserveRideSeatsAndCreateBooking(rideId, userId, seats, luggageCount, { payment_status: "pending" });
      } catch (err) {
        if (err.code === "SEATS_UNAVAILABLE") {
          return res.status(400).json({ success: false, message: err.message });
        }
        throw err;
      }
    }

    const offerIdObj = new mongoose.Types.ObjectId(offer_id);
    const matchedDriverId = offer.driver._id || offer.driver;
    const matchedRideId = offer.ride ? (offer.ride._id || offer.ride) : null;
    const atomicUpdate = [
      {
        $set: {
          status: "accepted",
          matched_driver: matchedDriverId,
          matched_ride: matchedRideId,
          offers: {
            $map: {
              input: "$offers",
              as: "o",
              in: {
                $mergeObjects: [
                  "$$o",
                  {
                    status: {
                      $cond: [
                        { $eq: ["$$o._id", offerIdObj] },
                        "accepted",
                        "rejected",
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];

    const updatedRequest = await RideRequest.findOneAndUpdate(
      { _id: requestId, passenger: userId, status: "pending" },
      atomicUpdate,
      { new: true },
    );

    if (!updatedRequest) {
      if (booking) await releaseBookingAndSeats(booking);
      return res.status(409).json({
        success: false,
        message: "Request was just accepted or is no longer pending. Please refresh.",
      });
    }

    await updatedRequest.populate([
      "airport",
      "matched_driver",
      "matched_ride",
      "offers.driver",
    ]);

    const acceptedOffer = updatedRequest.offers.id(offer_id);
    const driverId = acceptedOffer?.driver?._id || acceptedOffer?.driver || matchedDriverId;
    const driver = await User.findById(driverId).select('first_name last_name');
    const driverName = driver ? `${driver.first_name} ${driver.last_name}` : 'Driver';

    const passengerId = updatedRequest.passenger._id || updatedRequest.passenger;
    const passenger = await User.findById(passengerId).select('first_name last_name');
    const passengerName = passenger ? `${passenger.first_name} ${passenger.last_name}` : 'Passenger';

    await NotificationService.notifyRequestAccepted(passengerId, {
      request_id: updatedRequest._id,
      driver_id: driverId,
      driver_name: driverName,
      ride_id: acceptedOffer?.ride || matchedRideId,
      message: "Your ride request has been accepted by a driver.",
    });

    if (acceptedOffer?.driver) {
      await NotificationService.notifyOfferAccepted(driverId, {
        request_id: updatedRequest._id,
        passenger_id: passengerId,
        passenger_name: passengerName,
        ride_id: acceptedOffer.ride || matchedRideId,
        message: "Your offer has been accepted by the passenger.",
      });
    }

    for (const o of updatedRequest.offers) {
      if (o._id.toString() !== offer_id && o.driver) {
        const rejectedDriverId = o.driver._id || o.driver;
        await NotificationService.notifyOfferRejected(rejectedDriverId, {
          request_id: updatedRequest._id,
          passenger_id: passengerId,
          passenger_name: passengerName,
          ride_id: o.ride,
          message: "Your offer was not accepted.",
        });
      }
    }

    const userRequestKeysAccept = await safeKeys(`user_requests:${userId}:*`);
    if (userRequestKeysAccept.length > 0) await safeDel(userRequestKeysAccept);
    const driverOfferKeysAccept = await safeKeys(`driver_offers:${driverId}:*`);
    if (driverOfferKeysAccept.length > 0) await safeDel(driverOfferKeysAccept);
    const availableKeysAccept = await safeKeys(`available_requests:*`);
    if (availableKeysAccept.length > 0) await safeDel(availableKeysAccept);

    res.json({
      message: "Offer accepted successfully",
      request: updatedRequest,
    });
  } catch (error) {
    next(error);
  }
};

// Accept offer with payment (wallet or card)
exports.acceptOfferWithPayment = async (req, res, next) => {
  const Wallet = require("../models/Wallet");
  const Transaction = require("../models/Transaction");
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

  try {
    const { offer_id, payment_method, payment_intent_id } = req.body;
    const requestId = req.params.id;
    const userId = req.user.id;

    console.log("Accept offer with payment:", {
      requestId,
      offer_id,
      payment_method,
      userId,
    });

    const request = await RideRequest.findOne({
      _id: requestId,
      passenger: userId,
    }).populate("airport");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request is no longer pending" });
    }

    const offer = request.offers.id(offer_id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.status !== "pending") {
      return res.status(400).json({ message: "Offer is no longer pending" });
    }

    // Calculate total amount
    const totalAmount = Math.round(
      offer.price_per_seat * request.seats_needed * 100,
    ); // in cents
    const platformFeePercent = parseFloat(
      process.env.PLATFORM_FEE_PERCENT || "10",
    );
    const platformFee = Math.round(totalAmount * (platformFeePercent / 100));
    const driverEarnings = totalAmount - platformFee;

    console.log("Payment calculation:", {
      totalAmount,
      platformFee,
      driverEarnings,
    });

    if (payment_method === "wallet") {
      // Get passenger's wallet
      const passengerWallet = await Wallet.getOrCreateWallet(userId);

      // Check if passenger has enough balance
      if (passengerWallet.balance < totalAmount) {
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance",
          required: totalAmount,
          required_display: (totalAmount / 100).toFixed(2),
          available: passengerWallet.balance,
          available_display: (passengerWallet.balance / 100).toFixed(2),
          code: "INSUFFICIENT_BALANCE",
        });
      }

      // Deduct from passenger wallet
      passengerWallet.balance -= totalAmount;
      await passengerWallet.save();

      // Get passenger info
      const passenger = await User.findById(userId);
      const driver = await User.findById(offer.driver);

      // Create transaction record for passenger (debit)
      await Transaction.create({
        wallet_id: passengerWallet._id,
        user_id: userId,
        type: "ride_payment",
        amount: -totalAmount,
        gross_amount: totalAmount,
        fee_amount: 0,
        fee_percentage: 0,
        net_amount: totalAmount,
        currency: "EUR",
        status: "completed",
        reference_type: "ride",
        reference_id: request._id,
        description: `Payment for ride request - ${request.seats_needed} seat(s)`,
        ride_details: {
          ride_id: offer.ride || request._id,
          booking_id: request._id,
          driver_id: offer.driver,
          driver_name:
            driver?.name ||
            `${driver?.first_name} ${driver?.last_name}` ||
            "Driver",
          seats: request.seats_needed,
          price_per_seat: offer.price_per_seat,
          route: `${request.location_city || "Origin"} → ${request.airport?.name || "Airport"}`,
        },
        processed_at: new Date(),
      });

      // Credit driver's wallet
      const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
      await driverWallet.addEarnings(driverEarnings, false);

      // Create transaction record for driver (credit)
      await Transaction.create({
        wallet_id: driverWallet._id,
        user_id: offer.driver,
        type: "ride_earning",
        amount: driverEarnings,
        gross_amount: totalAmount,
        fee_amount: platformFee,
        fee_percentage: platformFeePercent,
        net_amount: driverEarnings,
        currency: "EUR",
        status: "completed",
        reference_type: "ride",
        reference_id: request._id,
        description: `Earnings from wallet payment - ${request.seats_needed} seat(s)`,
        ride_details: {
          ride_id: offer.ride || request._id,
          booking_id: request._id,
          passenger_id: userId,
          passenger_name:
            passenger?.name ||
            `${passenger?.first_name} ${passenger?.last_name}` ||
            "Passenger",
          seats: request.seats_needed,
          price_per_seat: offer.price_per_seat,
          route: `${request.location_city || "Origin"} → ${request.airport?.name || "Airport"}`,
        },
        processed_at: new Date(),
      });

      console.log(
        `Wallet payment completed: ${totalAmount} cents from passenger, ${driverEarnings} cents to driver`,
      );
    } else if (payment_method === "card") {
      // Verify payment with Stripe
      if (!payment_intent_id) {
        return res
          .status(400)
          .json({ message: "Payment intent ID required for card payment" });
      }

      const paymentIntent =
        await stripe.paymentIntents.retrieve(payment_intent_id);

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: `Payment not completed. Status: ${paymentIntent.status}`,
        });
      }

      console.log("Card payment verified:", paymentIntent.id);

      // Credit driver's wallet (if driver doesn't have Stripe Connect)
      const driver = await User.findById(offer.driver);
      if (!driver?.stripeAccountId) {
        const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
        await driverWallet.addEarnings(driverEarnings, false);

        const passenger = await User.findById(userId);

        await Transaction.create({
          wallet_id: driverWallet._id,
          user_id: offer.driver,
          type: "ride_earning",
          amount: driverEarnings,
          gross_amount: totalAmount,
          fee_amount: platformFee,
          fee_percentage: platformFeePercent,
          net_amount: driverEarnings,
          currency: "EUR",
          status: "completed",
          reference_type: "ride",
          reference_id: request._id,
          stripe_payment_intent_id: payment_intent_id,
          description: `Earnings from ride request - ${request.seats_needed} seat(s)`,
          ride_details: {
            ride_id: offer.ride || request._id,
            booking_id: request._id,
            passenger_id: userId,
            passenger_name:
              passenger?.name ||
              `${passenger?.first_name} ${passenger?.last_name}` ||
              "Passenger",
            seats: request.seats_needed,
            price_per_seat: offer.price_per_seat,
            route: `${request.location_city || "Origin"} → ${request.airport?.name || "Airport"}`,
          },
          processed_at: new Date(),
        });

        console.log(
          `Card payment credited to driver wallet: ${driverEarnings} cents`,
        );
      }
    } else {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // Reserve seats on the ride and create booking (so same seats cannot be sold twice)
    const rideId = offer.ride ? (offer.ride._id || offer.ride) : null;
    const seats = request.seats_needed || 1;
    const luggageCount = request.luggage_count || 0;
    let bookingFromRequest = null;

    if (rideId) {
      try {
        bookingFromRequest = await reserveRideSeatsAndCreateBooking(rideId, userId, seats, luggageCount, {
          payment_status: "paid",
          payment_method,
          payment_intent_id: payment_method === "card" ? payment_intent_id : undefined,
        });
      } catch (err) {
        if (err.code === "SEATS_UNAVAILABLE") {
          // Refund: payment was taken but seats no longer available
          if (payment_method === "wallet") {
            const passengerWallet = await Wallet.getOrCreateWallet(userId);
            passengerWallet.balance += totalAmount;
            await passengerWallet.save();
            await Transaction.create({
              wallet_id: passengerWallet._id,
              user_id: userId,
              type: "refund",
              amount: totalAmount,
              gross_amount: totalAmount,
              fee_amount: 0,
              fee_percentage: 0,
              net_amount: totalAmount,
              currency: "EUR",
              status: "completed",
              reference_type: "ride",
              reference_id: request._id,
              description: `Refund: seats unavailable after payment - ${request.seats_needed} seat(s)`,
              ride_details: {
                ride_id: offer.ride || request._id,
                booking_id: request._id,
                driver_id: offer.driver,
                route: `${request.location_city || "Origin"} → ${request.airport?.name || "Airport"}`,
              },
              processed_at: new Date(),
            });
            const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
            if (driverWallet.balance >= driverEarnings) {
              driverWallet.balance -= driverEarnings;
              await driverWallet.save();
              await Transaction.create({
                wallet_id: driverWallet._id,
                user_id: offer.driver,
                type: "adjustment",
                amount: -driverEarnings,
                gross_amount: driverEarnings,
                fee_amount: 0,
                fee_percentage: 0,
                net_amount: -driverEarnings,
                currency: "EUR",
                status: "completed",
                reference_type: "ride",
                reference_id: request._id,
                description: `Reversal: seats unavailable after payment - ${request.seats_needed} seat(s)`,
                ride_details: {
                  ride_id: offer.ride || request._id,
                  booking_id: request._id,
                  passenger_id: userId,
                  route: `${request.location_city || "Origin"} → ${request.airport?.name || "Airport"}`,
                },
                processed_at: new Date(),
              });
            }
          } else if (payment_method === "card" && payment_intent_id) {
            await stripe.refunds.create({ payment_intent: payment_intent_id });
            const driver = await User.findById(offer.driver);
            if (!driver?.stripeAccountId) {
              const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
              if (driverWallet.balance >= driverEarnings) {
                driverWallet.balance -= driverEarnings;
                await driverWallet.save();
                await Transaction.create({
                  wallet_id: driverWallet._id,
                  user_id: offer.driver,
                  type: "adjustment",
                  amount: -driverEarnings,
                  gross_amount: driverEarnings,
                  fee_amount: 0,
                  fee_percentage: 0,
                  net_amount: -driverEarnings,
                  currency: "EUR",
                  status: "completed",
                  reference_type: "ride",
                  reference_id: request._id,
                  description: `Reversal: seats unavailable after card refund - ${request.seats_needed} seat(s)`,
                  processed_at: new Date(),
                });
              }
            }
          }
          return res.status(400).json({ success: false, message: err.message });
        }
        throw err;
      }
    }

    const offerIdObjPay = new mongoose.Types.ObjectId(offer_id);
    const matchedDriverIdPay = offer.driver._id || offer.driver;
    const matchedRideIdPay = offer.ride ? (offer.ride._id || offer.ride) : null;
    const paidAt = new Date();
    const atomicUpdateWithPayment = [
      {
        $set: {
          status: "accepted",
          matched_driver: matchedDriverIdPay,
          matched_ride: matchedRideIdPay,
          payment_status: "paid",
          offers: {
            $map: {
              input: "$offers",
              as: "o",
              in: {
                $mergeObjects: [
                  "$$o",
                  {
                    status: {
                      $cond: [
                        { $eq: ["$$o._id", offerIdObjPay] },
                        "accepted",
                        "rejected",
                      ],
                    },
                    payment_method: {
                      $cond: [
                        { $eq: ["$$o._id", offerIdObjPay] },
                        payment_method,
                        "$$o.payment_method",
                      ],
                    },
                    paid_at: {
                      $cond: [
                        { $eq: ["$$o._id", offerIdObjPay] },
                        paidAt,
                        "$$o.paid_at",
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ];

    const updatedRequestPay = await RideRequest.findOneAndUpdate(
      { _id: requestId, passenger: userId, status: "pending" },
      atomicUpdateWithPayment,
      { new: true },
    );

    if (!updatedRequestPay) {
      if (bookingFromRequest) await releaseBookingAndSeats(bookingFromRequest);
      if (payment_method === "wallet") {
        const passengerWallet = await Wallet.getOrCreateWallet(userId);
        passengerWallet.balance += totalAmount;
        await passengerWallet.save();
        const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
        if (driverWallet.balance >= driverEarnings) {
          driverWallet.balance -= driverEarnings;
          await driverWallet.save();
        }
      } else if (payment_method === "card" && payment_intent_id) {
        await stripe.refunds.create({ payment_intent: payment_intent_id });
        const driver = await User.findById(offer.driver);
        if (!driver?.stripeAccountId) {
          const driverWallet = await Wallet.getOrCreateWallet(offer.driver);
          if (driverWallet.balance >= driverEarnings) {
            driverWallet.balance -= driverEarnings;
            await driverWallet.save();
          }
        }
      }
      return res.status(409).json({
        success: false,
        message: "Request was just accepted or is no longer pending. Payment has been refunded.",
      });
    }

    await updatedRequestPay.populate([
      "airport",
      "matched_driver",
      "matched_ride",
      "offers.driver",
    ]);

    const acceptedOfferPay = updatedRequestPay.offers.id(offer_id);
    const driverId = acceptedOfferPay?.driver?._id || acceptedOfferPay?.driver || matchedDriverIdPay;
    const driver = await User.findById(driverId).select('first_name last_name');
    const driverName = driver ? `${driver.first_name} ${driver.last_name}` : 'Driver';

    const passengerId = updatedRequestPay.passenger._id || updatedRequestPay.passenger;
    const passenger = await User.findById(passengerId).select('first_name last_name');
    const passengerName = passenger ? `${passenger.first_name} ${passenger.last_name}` : 'Passenger';

    await NotificationService.notifyRequestAccepted(passengerId, {
      request_id: updatedRequestPay._id,
      driver_id: driverId,
      driver_name: driverName,
      ride_id: acceptedOfferPay?.ride || matchedRideIdPay,
      message: "Your ride request has been accepted and paid.",
    });

    if (acceptedOfferPay?.driver) {
      await NotificationService.notifyOfferAccepted(driverId, {
        request_id: updatedRequestPay._id,
        passenger_id: passengerId,
        passenger_name: passengerName,
        ride_id: acceptedOfferPay.ride || matchedRideIdPay,
        message: "Your offer has been accepted and paid by the passenger.",
      });
    }

    for (const o of updatedRequestPay.offers) {
      if (o._id.toString() !== offer_id && o.driver) {
        const rejectedDriverId = o.driver._id || o.driver;
        await NotificationService.notifyOfferRejected(rejectedDriverId, {
          request_id: updatedRequestPay._id,
          passenger_id: passengerId,
          passenger_name: passengerName,
          ride_id: o.ride,
          message: "Your offer was not accepted.",
        });
      }
    }

    const userRequestKeys2 = await safeKeys(`user_requests:${userId}:*`);
    if (userRequestKeys2.length > 0) {
      await safeDel(userRequestKeys2);
    }
    const driverOfferKeys2 = await safeKeys(`driver_offers:${matchedDriverIdPay}:*`);
    if (driverOfferKeys2.length > 0) {
      await safeDel(driverOfferKeys2);
    }
    const availableKeys3 = await safeKeys(`available_requests:*`);
    if (availableKeys3.length > 0) {
      await safeDel(availableKeys3);
    }

    res.json({
      success: true,
      message: "Offer accepted and payment processed successfully",
      request: updatedRequestPay,
      payment: {
        method: payment_method,
        amount: totalAmount,
        amount_display: (totalAmount / 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Accept offer with payment error:", error);
    next(error);
  }
};

// Passenger rejects an offer
exports.rejectOffer = async (req, res, next) => {
  try {
    const { offer_id } = req.body;
    const requestId = req.params.id;

    const request = await RideRequest.findOne({
      _id: requestId,
      passenger: req.user.id,
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const offer = request.offers.id(offer_id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    offer.status = "rejected";
    await request.save();

    // Notify the driver that their offer was rejected
    if (offer.driver) {
      const driverId = offer.driver._id || offer.driver;
      const passengerId = request.passenger._id || request.passenger;
      
      const passenger = await User.findById(passengerId).select('first_name last_name');
      const passengerName = passenger ? `${passenger.first_name} ${passenger.last_name}` : 'Passenger';
      
      await NotificationService.notifyOfferRejected(driverId, {
        request_id: request._id,
        passenger_id: passengerId,
        passenger_name: passengerName,
        ride_id: offer.ride,
        message: "Your offer was rejected by the passenger.",
      });
    }

    // Invalidate relevant caches
    const userRequestKeys3 = await safeKeys(`user_requests:${req.user.id}:*`);
    if (userRequestKeys3.length > 0) {
      await safeDel(userRequestKeys3);
    }
    const driverOfferKeys3 = await safeKeys(`driver_offers:${offer.driver}:*`);
    if (driverOfferKeys3.length > 0) {
      await safeDel(driverOfferKeys3);
    }

    res.json({
      message: "Offer rejected",
      request,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel a request (passenger only)
exports.cancelRequest = async (req, res, next) => {
  try {
    const request = await RideRequest.findOne({
      _id: req.params.id,
      passenger: req.user.id,
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status === "accepted") {
      return res
        .status(400)
        .json({ message: "Cannot cancel a request that has already been accepted" });
    }

    await RideRequest.deleteOne({ _id: request._id });

    res.json({
      message: "Request cancelled and removed successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};

// Driver withdraws their offer
exports.withdrawOffer = async (req, res, next) => {
  try {
    const requestId = req.params.id;

    const request = await RideRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const offerIndex = request.offers.findIndex(
      (o) => o.driver.toString() === req.user.id && o.status === "pending",
    );

    if (offerIndex === -1) {
      return res.status(404).json({ message: "No pending offer found" });
    }

    request.offers.splice(offerIndex, 1);
    await request.save();

    res.json({
      message: "Offer withdrawn successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};
