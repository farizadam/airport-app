const Airport = require("../models/Airport");

class AirportController {
  /**
   * Get all airports (with search and geo-location)
   * GET /api/v1/airports
   */
  static async getAll(req, res, next) {
    try {
      const { country, q, latitude, longitude, radius = 50000 } = req.query; // Default radius 50km

      const filter = { is_active: true };

      if (country) {
        filter.country = country;
      }

      // Text Search
      if (q) {
        const regex = new RegExp(q, "i");
        filter.$or = [
          { name: regex },
          { iata_code: regex },
          { city: regex },
        ];
      }

      // Geospatial Search
      if (latitude && longitude) {
        filter.location = {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            $maxDistance: parseInt(radius),
          },
        };
      }

      // If no search params, limit strictly to avoid dumping 5000 records
      // But if user wants full list for country, let them? 
      // 842 is manageable, but let's limit to 100 for general queries
      const limit = q || (latitude && longitude) ? 100 : 842;

      const airports = await Airport.find(filter)
        .sort({ name: 1 })
        .limit(limit);

      res.status(200).json({
        success: true,
        data: airports,
        count: airports.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get airport by ID
   * GET /api/v1/airports/:id
   */
  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const airport = await Airport.findById(id);

      if (!airport) {
        return res.status(404).json({
          success: false,
          message: "Airport not found",
        });
      }

      res.status(200).json({
        success: true,
        data: airport,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AirportController;
