const mongoose = require("mongoose");

const airportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    iata_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    icao_code: {
      type: String,
      uppercase: true,
      sparse: true, // Allow nulls but index values if present
    },
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    country_code: {
      type: String,
      required: true,
      uppercase: true,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    type: {
      type: String,
      enum: ["large_airport", "medium_airport", "small_airport", "closed"],
      default: "medium_airport",
    },
    aliases: {
      type: [String],
      default: [],
    },
    timezone: {
      type: String,
      default: "Europe/Paris",
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

airportSchema.index({ location: "2dsphere" });

const Airport = mongoose.model("Airport", airportSchema);

module.exports = Airport;
