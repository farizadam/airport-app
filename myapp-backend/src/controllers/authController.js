const bcrypt = require("bcrypt");
const { generateTokens, verifyRefreshToken } = require("../utils/jwt");
const User = require("../models/User");

const SALT_ROUNDS = 10;

class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  static async register(req, res, next) {
    try {
      const { email, password, first_name, last_name, phone, role } =
        req.validatedBody;

      // Check if user already exists
      const existingUser = await User.findOne({ email, deleted_at: null });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists",
        });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const user = await User.create({
        email,
        password_hash,
        first_name,
        last_name,
        phone,
        role,
      });

      // Generate tokens
      const tokens = generateTokens(user._id.toString());

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: user.toJSON(),
          ...tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.validatedBody;

      // Find user by email
      const user = await User.findOne({ email, deleted_at: null });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Generate tokens
      const tokens = generateTokens(user._id.toString());

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: user.toJSON(),
          ...tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  static async refresh(req, res, next) {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      const decoded = verifyRefreshToken(refresh_token);

      // Verify user still exists
      const user = await User.findOne({
        _id: decoded.userId,
        deleted_at: null,
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate new tokens
      const tokens = generateTokens(user._id.toString());

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: user.toJSON(),
          ...tokens,
        },
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
  }

  /**
   * Logout (client-side token removal, optional blacklist implementation)
   * POST /api/v1/auth/logout
   */
  static async logout(req, res) {
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  }

  /**
   * Delete user account
   * DELETE /api/v1/auth/me
   */
  static async deleteAccount(req, res, next) {
    try {
      const userId = req.user.id;

      await User.findByIdAndUpdate(userId, { deleted_at: new Date() });

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
