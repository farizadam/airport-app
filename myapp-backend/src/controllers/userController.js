const User = require("../models/User");

class UserController {
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
        { new: true, runValidators: true }
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
        { new: true }
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
        { new: true }
      ).select("saved_locations");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Location not found",
        });
      }

      const updatedLocation = user.saved_locations.find(
        (loc) => loc._id.toString() === locationId
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
        { new: true }
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
}

module.exports = UserController;
