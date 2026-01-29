const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const User = require("../models/User");

class UserController {
  /**
   * Create Stripe Connect account for user
   * POST /api/v1/users/me/stripe-account
   */
  static async createStripeAccount(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      // If already has a Stripe account, return it
      if (user.stripeAccountId) {
        return res
          .status(200)
          .json({ success: true, stripeAccountId: user.stripeAccountId });
      }
      // Create Stripe Connect account (Express type)
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        individual: {
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      });
      user.stripeAccountId = account.id;
      await user.save();
      // Optionally, create an onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: process.env.STRIPE_ONBOARD_REFRESH_URL,
        return_url: process.env.STRIPE_ONBOARD_RETURN_URL,
        type: "account_onboarding",
      });
      res.status(201).json({
        success: true,
        stripeAccountId: account.id,
        onboardingUrl: accountLink.url,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Get current user profile
   * GET /api/v1/users/me
   */
  static async getProfile(req, res, next) {
    try {
      const user = req.user; // Already attached by auth middleware

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   * PATCH /api/v1/users/me
   */
  static async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updates = req.validatedBody;

      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, deleted_at: null },
        updates,
        { new: true, runValidators: true },
      ).select("-password_hash");

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get saved locations
   * GET /api/v1/users/me/locations
   */
  static async getSavedLocations(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await User.findById(userId).select("saved_locations");

      res.status(200).json({
        success: true,
        data: user?.saved_locations || [],
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add a saved location
   * POST /api/v1/users/me/locations
   */
  static async addSavedLocation(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        name,
        address,
        city,
        postcode,
        country,
        latitude,
        longitude,
        placeId,
      } = req.body;

      if (
        !name ||
        !address ||
        !city ||
        latitude === undefined ||
        longitude === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Name, address, city, latitude, and longitude are required",
        });
      }

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            saved_locations: {
              name,
              address,
              city,
              postcode,
              country,
              latitude,
              longitude,
              placeId,
            },
          },
        },
        { new: true },
      ).select("saved_locations");

      const newLocation = user.saved_locations[user.saved_locations.length - 1];

      res.status(201).json({
        success: true,
        message: "Location saved successfully",
        data: newLocation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a saved location
   * PATCH /api/v1/users/me/locations/:locationId
   */
  static async updateSavedLocation(req, res, next) {
    try {
      const userId = req.user.id;
      const { locationId } = req.params;
      const updates = req.body;

      const user = await User.findOneAndUpdate(
        { _id: userId, "saved_locations._id": locationId },
        {
          $set: {
            "saved_locations.$.name": updates.name,
            "saved_locations.$.address": updates.address,
            "saved_locations.$.city": updates.city,
            "saved_locations.$.postcode": updates.postcode,
            "saved_locations.$.country": updates.country,
            "saved_locations.$.latitude": updates.latitude,
            "saved_locations.$.longitude": updates.longitude,
            "saved_locations.$.placeId": updates.placeId,
          },
        },
        { new: true },
      ).select("saved_locations");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Location not found",
        });
      }

      const updatedLocation = user.saved_locations.find(
        (loc) => loc._id.toString() === locationId,
      );

      res.status(200).json({
        success: true,
        message: "Location updated successfully",
        data: updatedLocation,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a saved location
   * DELETE /api/v1/users/me/locations/:locationId
   */
  static async deleteSavedLocation(req, res, next) {
    try {
      const userId = req.user.id;
      const { locationId } = req.params;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            saved_locations: { _id: locationId },
          },
        },
        { new: true },
      ).select("saved_locations");

      res.status(200).json({
        success: true,
        message: "Location deleted successfully",
        data: user?.saved_locations || [],
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload avatar (base64)
   * POST /api/v1/users/me/avatar
   */
  static async uploadAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          message: "Image data is required",
        });
      }

      // Validate base64 image (should start with data:image/)
      if (!image.startsWith("data:image/")) {
        return res.status(400).json({
          success: false,
          message: "Invalid image format. Must be base64 encoded image.",
        });
      }

      // Check image size (limit to ~2MB in base64)
      const base64Length = image.length - (image.indexOf(",") + 1);
      const sizeInBytes = (base64Length * 3) / 4;
      const maxSize = 2 * 1024 * 1024; // 2MB

      if (sizeInBytes > maxSize) {
        return res.status(400).json({
          success: false,
          message: "Image too large. Maximum size is 2MB.",
        });
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar_url: image },
        { new: true },
      ).select("-password_hash");

      res.status(200).json({
        success: true,
        message: "Avatar uploaded successfully",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete avatar
   * DELETE /api/v1/users/me/avatar
   */
  static async deleteAvatar(req, res, next) {
    try {
      const userId = req.user.id;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar_url: null },
        { new: true },
      ).select("-password_hash");

      res.status(200).json({
        success: true,
        message: "Avatar deleted successfully",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
