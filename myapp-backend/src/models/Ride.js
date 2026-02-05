const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    driver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    airport_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Airport",
      required: true,
      index: true,
    },
    direction: {
      type: String,
      required: true,
      enum: ["home_to_airport", "airport_to_home"],
    },
    home_address: {
      type: String,
      default: null,
    },
    home_postcode: {
      type: String,
      required: false,
      index: true,
    },
    home_city: {
      type: String,
      required: true,
    },
    home_latitude: {
      type: Number,
      required: false, // Optional for backward compatibility
    },
    home_longitude: {
      type: Number,
      required: false, // Optional for backward compatibility
    },
    datetime_start: {
      type: Date,
      required: true,
      index: true,
    },
    seats_total: {
      type: Number,
      required: true,
      min: 1,
    },
    seats_left: {
      type: Number,
      required: true,
      min: 0,
    },
    price_per_seat: {
      type: Number,
      required: true,
      min: 0,
    },
    comment: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "cancelled", "completed"],
      default: "active",
      index: true,
    },
    route: {
      type: {
        type: String,
        enum: ["LineString"],
        default: "LineString",
      },
      coordinates: {
        type: [[Number]], // Array of [longitude, latitude] arrays
        required: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Compound index for search queries
rideSchema.index({ airport_id: 1, direction: 1, datetime_start: 1, status: 1 });
// Geospatial index for route matching
rideSchema.index({ route: "2dsphere" });

const Ride = mongoose.model("Ride", rideSchema);

module.exports = Ride;
