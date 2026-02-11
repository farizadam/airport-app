const express = require("express");
const AuthController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");
const { validate, validationRules, Joi } = require("../middleware/validation");

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: validationRules.email,
  password: validationRules.password,
  first_name: validationRules.firstName,
  last_name: validationRules.lastName,
  phone: validationRules.phone,
  role: validationRules.role,
});

const loginSchema = Joi.object({
  email: validationRules.email,
  password: Joi.string().required(),
});

// Routes
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", authMiddleware, AuthController.logout);
router.delete("/me", authMiddleware, AuthController.deleteAccount);

module.exports = router;
