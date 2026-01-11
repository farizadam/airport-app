const express = require("express");
const UserController = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");
const { validate, validationRules, Joi } = require("../middleware/validation");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation schema for profile update
const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).trim(),
  last_name: Joi.string().min(2).max(100).trim(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  role: Joi.string().valid("driver", "passenger", "both"),
  avatar_url: Joi.string().uri().allow(null, ""),
}).min(1); // At least one field required

// Routes
router.get("/me", UserController.getProfile);
router.patch(
  "/me",
  validate(updateProfileSchema),
  UserController.updateProfile
);

// Saved locations routes
router.get("/me/locations", UserController.getSavedLocations);
router.post("/me/locations", UserController.addSavedLocation);
router.patch("/me/locations/:locationId", UserController.updateSavedLocation);
router.delete("/me/locations/:locationId", UserController.deleteSavedLocation);

module.exports = router;
