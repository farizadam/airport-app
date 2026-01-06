require("dotenv").config();
const { connectDB } = require("../config/database");
const Airport = require("../models/Airport");

/**
 * Seed airports with French airports data
 */
async function seedAirports() {
  try {
    await connectDB();
    console.log("🌱 Seeding airports...");

    const airports = [
      {
        name: "Paris Charles de Gaulle",
        iata_code: "CDG",
        city: "Paris",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Paris Orly",
        iata_code: "ORY",
        city: "Paris",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Nice Côte d'Azur",
        iata_code: "NCE",
        city: "Nice",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Lyon Saint-Exupéry",
        iata_code: "LYS",
        city: "Lyon",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Marseille Provence",
        iata_code: "MRS",
        city: "Marseille",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Toulouse-Blagnac",
        iata_code: "TLS",
        city: "Toulouse",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Paris Beauvais-Tillé",
        iata_code: "BVA",
        city: "Beauvais",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Bordeaux-Mérignac",
        iata_code: "BOD",
        city: "Bordeaux",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Nantes Atlantique",
        iata_code: "NTE",
        city: "Nantes",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Strasbourg",
        iata_code: "SXB",
        city: "Strasbourg",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Lille-Lesquin",
        iata_code: "LIL",
        city: "Lille",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Montpellier-Méditerranée",
        iata_code: "MPL",
        city: "Montpellier",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Rennes–Saint-Jacques",
        iata_code: "RNS",
        city: "Rennes",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
      {
        name: "Bâle-Mulhouse",
        iata_code: "BSL",
        city: "Mulhouse",
        country: "France",
        timezone: "Europe/Paris",
        is_active: true,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const airportData of airports) {
      try {
        // Check if already exists
        const existing = await Airport.findOne({
          iata_code: airportData.iata_code,
        });

        if (existing) {
          console.log(
            `  ⏭️  ${airportData.iata_code} already exists, skipping...`
          );
          skipped++;
        } else {
          await Airport.create(airportData);
          console.log(
            `  ✅ Created ${airportData.name} (${airportData.iata_code})`
          );
          created++;
        }
      } catch (error) {
        console.error(
          `  ❌ Error creating ${airportData.iata_code}:`,
          error.message
        );
      }
    }

    console.log(
      `\n✅ Seeding complete! Created: ${created}, Skipped: ${skipped}`
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedAirports();
