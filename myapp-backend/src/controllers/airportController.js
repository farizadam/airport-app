const Airport = require("../models/Airport");

class AirportController {
  /**
   * Get all airports
   * GET /api/v1/airports
   */
  static async getAll(req, res, next) {
    try {
      const { country } = req.query;

      const filter = { is_active: true };
      if (country) {
        filter.country = country;
      }

      const airports = await Airport.find(filter).sort({ name: 1 });

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
