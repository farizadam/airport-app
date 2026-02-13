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
    city: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
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

const Airport = mongoose.model("Airport", airportSchema);

module.exports = Airport;
