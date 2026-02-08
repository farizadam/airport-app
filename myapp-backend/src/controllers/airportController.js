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

      // Text Search using MongoDB text index
      if (q) {
        filter.$text = { $search: q };
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

      if (country) {
        filter.country = country;
      }

      // Determine limit based on query specificity
      const limit = q || country || (latitude && longitude) ? 100 : 50;

      let query = Airport.find(filter).limit(limit);

      // Add text score sorting if text search was used
      if (q) {
        query = query
          .select({ score: { $meta: "textScore" } })
          .sort({ score: { $meta: "textScore" } });
      } else {
        query = query.sort({ name: 1 });
      }

      const airports = await query;

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
