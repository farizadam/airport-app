const express = require("express");
const cors = require("cors");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Import Route files
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const airportRoutes = require("./routes/airportRoutes");
const rideRoutes = require("./routes/rideRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const rideRequestRoutes = require("./routes/rideRequestRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// --- ROUTES ---
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Airport Carpooling API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      airports: "/api/v1/airports",
      rides: "/api/v1/rides",
      bookings: "/api/v1/bookings",
      rideRequests: "/api/v1/ride-requests",
    },
  });
});

// API Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/airports", airportRoutes);
app.use("/api/v1/rides", rideRoutes);
app.use("/api/v1", bookingRoutes); // Includes /rides/:rideId/bookings and /me/bookings

app.use("/api/v1/ride-requests", rideRequestRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/payments", paymentRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// --- ERROR HANDLING ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- EXPORT ---
module.exports = app;
