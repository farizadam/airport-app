// 1. Load Environment Variables
require("dotenv").config();

// 2. Import the Application and DB Connection
const { connectDB } = require("./src/config/database");
const app = require("./src/app");

// 3. Define the Port
const PORT = process.env.PORT || 3000;

// 4. Connect to Database and Start the Server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
    🚀 Server is running!
    📡 Port: ${PORT}
    🌐 Environment: ${process.env.NODE_ENV || "development"}
      `);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
