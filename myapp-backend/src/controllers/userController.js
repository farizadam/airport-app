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
}

module.exports = UserController;
