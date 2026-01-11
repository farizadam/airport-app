const RideRequest = require("../models/RideRequest");
const Airport = require("../models/Airport");
const User = require("../models/User");
const Ride = require("../models/Ride");

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

    // Set expiry to preferred_datetime (request expires after that)
    const expiresAt = new Date(preferred_datetime);

    const request = await RideRequest.create({
      passenger: req.user.id,
      airport: airport_id,
      direction,
      location_address,
      location_city,
      location_postcode,
      location_latitude,
      location_longitude,
      preferred_datetime,
      time_flexibility: time_flexibility || 30,
      seats_needed: seats_needed || 1,
      luggage_count: luggage_count || 1,
      max_price_per_seat,
      notes,
      expires_at: expiresAt,
    });

    await request.populate(["airport", "passenger"]);

    res.status(201).json({
      message: "Ride request created successfully",
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

    const query = { passenger: req.user.id };
    if (status) query.status = status;

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name phone")
      .populate("matched_driver", "first_name last_name phone rating")
      .populate("matched_ride")
      .populate("offers.driver", "first_name last_name phone rating")
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RideRequest.countDocuments(query);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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
      page = 1,
      limit = 10,
    } = req.query;

    const query = {
      status: "pending",
      expires_at: { $gt: new Date() },
      passenger: { $ne: req.user.id }, // Don't show own requests
    };

    if (airport_id) query.airport = airport_id;
    if (direction) query.direction = direction;
    if (city) query.location_city = new RegExp(city, "i");

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.preferred_datetime = { $gte: startDate, $lte: endDate };
    }

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name rating")
      .sort({ preferred_datetime: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await RideRequest.countDocuments(query);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get driver's offers - requests where driver sent an offer or was matched
exports.getMyOffers = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

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
      query = {
        "offers.driver": userId,
        status: { $in: ["pending", "cancelled", "expired"] },
      };
    }

    const requests = await RideRequest.find(query)
      .populate("airport")
      .populate("passenger", "first_name last_name phone rating")
      .populate("matched_driver", "first_name last_name phone rating")
      .populate("offers.driver", "first_name last_name phone rating")
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
          o.driver?.toString() === userId
      );
      return {
        ...reqObj,
        my_offer: myOffer || null,
        is_matched: reqObj.matched_driver?._id?.toString() === userId,
      };
    });

    res.json({
      requests: requestsWithOfferInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single request details
exports.getRequest = async (req, res, next) => {
  try {
    const request = await RideRequest.findById(req.params.id)
      .populate("airport")
      .populate("passenger", "first_name last_name phone rating")
      .populate("matched_driver", "first_name last_name phone rating")
      .populate("matched_ride")
      .populate("offers.driver", "first_name last_name phone rating")
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
      (o) => o.driver.toString() === req.user.id
    );
    if (existingOffer) {
      return res
        .status(400)
        .json({ message: "You already made an offer on this request" });
    }

    // Verify ride belongs to driver if ride_id provided
    let ride = null;
    if (ride_id) {
      ride = await Ride.findOne({ _id: ride_id, driver: req.user.id });
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
      "first_name last_name phone rating"
    );

    res.json({
      message: "Offer sent successfully",
      request,
    });
  } catch (error) {
    next(error);
  }
};

// Passenger accepts an offer
exports.acceptOffer = async (req, res, next) => {
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

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request is no longer pending" });
    }

    const offer = request.offers.id(offer_id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Accept this offer
    offer.status = "accepted";

    // Reject all other offers
    request.offers.forEach((o) => {
      if (o._id.toString() !== offer_id) {
        o.status = "rejected";
      }
    });

    request.status = "accepted";
    request.matched_driver = offer.driver;
    request.matched_ride = offer.ride;

    await request.save();
    await request.populate([
      "airport",
      "matched_driver",
      "matched_ride",
      "offers.driver",
    ]);

    res.json({
      message: "Offer accepted successfully",
      request,
    });
  } catch (error) {
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

    if (request.status === "cancelled") {
      return res.status(400).json({ message: "Request already cancelled" });
    }

    request.status = "cancelled";
    await request.save();

    res.json({
      message: "Request cancelled successfully",
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
      (o) => o.driver.toString() === req.user.id && o.status === "pending"
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
