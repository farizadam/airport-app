const mongoose = require("mongoose");

const savedLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    postcode: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    placeId: {
      type: String,
      default: null,
    },
  },
  { _id: true, timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: false,
      enum: ["driver", "passenger", "both"],
      default: "both",
    },
    avatar_url: {
      type: String,
      default: null,
    },
    saved_locations: {
      type: [savedLocationSchema],
      default: [],
    },
    deleted_at: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.password_hash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for active users (not deleted)
userSchema.index({ email: 1, deleted_at: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
