
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

import verifyToken from "./middleware/verifyToken.js";
import verifyAdmin from "./middleware/verifyAdmin.js";

const app = express();
const PORT = process.env.PORT || 8000;

// =====================================
// CHECK ENVIRONMENT VARIABLES
// =====================================

console.log(
  "Backend JWT_SECRET loaded:",
  Boolean(process.env.JWT_SECRET)
);

if (!process.env.MONGODB_URL) {
  console.error("MONGODB_URL is missing in backend .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing in backend .env");
  process.exit(1);
}

// =====================================
// MIDDLEWARE
// =====================================

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

// =====================================
// MONGODB CONNECTION
// =====================================

const client = new MongoClient(process.env.MONGODB_URL);

let destinationCollection;
let bookingCollection;

// =====================================
// TEST ROUTE
// =====================================

app.get("/", (req, res) => {
  res.send({
    success: true,
    message: "WanderLast Server is Running!",
  });
});

// =====================================
// DESTINATION APIs
// =====================================

// Add destination
app.post("/add-destination", async (req, res) => {
  try {
    const destination = req.body;

    const result = await destinationCollection.insertOne({
      ...destination,
      createdAt: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Destination added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Add destination error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to add destination",
    });
  }
});

// Get all destinations
app.get("/destination", async (req, res) => {
  try {
    const result = await destinationCollection.find().toArray();

    res.send(result);
  } catch (error) {
    console.error("Get destinations error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch destinations",
    });
  }
});

// Get one destination
app.get("/destination/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid Destination ID",
      });
    }

    const result = await destinationCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({
        success: false,
        message: "Destination not found",
      });
    }

    res.send(result);
  } catch (error) {
    console.error("Get destination error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch destination",
    });
  }
});

// Update destination
app.patch("/destination/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid ID",
      });
    }

    const result = await destinationCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Destination not found",
      });
    }

    res.send({
      success: true,
      message: "Destination updated successfully",
      result,
    });
  } catch (error) {
    console.error("Update destination error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to update destination",
    });
  }
});

// =====================================
// BOOKING APIs - JWT PROTECTED
// =====================================

// Create booking
app.post("/bookings", verifyToken, async (req, res) => {
  try {
    const {
      destinationId,
      customerName,
      email,
      phone,
      travelers,
      departureDate,
    } = req.body;

    const userId = req.user.userId;

    // Validate booking information
    if (
      !userId ||
      !destinationId ||
      !ObjectId.isValid(destinationId) ||
      !customerName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !departureDate ||
      !Number.isInteger(Number(travelers)) ||
      Number(travelers) < 1 ||
      Number(travelers) > 20
    ) {
      return res.status(400).send({
        success: false,
        message: "Please provide valid booking information",
      });
    }

    const date = new Date(departureDate);

    if (Number.isNaN(date.getTime())) {
      return res.status(400).send({
        success: false,
        message: "Invalid departure date",
      });
    }

    // Find destination
    const destination = await destinationCollection.findOne({
      _id: new ObjectId(destinationId),
    });

    if (!destination) {
      return res.status(404).send({
        success: false,
        message: "Destination not found",
      });
    }

    const price = Number(destination.price);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).send({
        success: false,
        message: "Destination price is invalid",
      });
    }

    // Create booking document
    const booking = {
      userId,
      destinationId: new ObjectId(destinationId),

      destinationName:
        destination.name || destination.title || "Destination",

      destinationImage:
        destination.image || destination.imageUrl || "",

      customerName: customerName.trim(),
      email: email.trim(),
      phone: phone.trim(),

      travelers: Number(travelers),
      departureDate: date,

      price,
      totalPrice: price * Number(travelers),

      status: "pending",
      createdAt: new Date(),
    };

    const result = await bookingCollection.insertOne(booking);

    res.status(201).send({
      success: true,
      message: "Booking created successfully",
      bookingId: result.insertedId,
    });
  } catch (error) {
    console.error("Booking Error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to create booking",
    });
  }
});

// =====================================
// GET LOGGED-IN USER'S BOOKINGS
// =====================================

app.get("/bookings", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const bookings = await bookingCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(bookings);
  } catch (error) {
    console.error("Get bookings error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
});

// =====================================
// DELETE USER'S OWN BOOKING
// =====================================

app.delete("/bookings/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const result = await bookingCollection.deleteOne({
      _id: new ObjectId(id),
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found",
      });
    }

    res.send({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Delete booking error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to delete booking",
    });
  }
});

// =====================================
// CANCEL USER'S OWN BOOKING
// =====================================

app.patch("/bookings/:id/cancel", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const result = await bookingCollection.updateOne(
      {
        _id: new ObjectId(id),
        userId,
        status: { $in: ["pending", "confirmed"] },
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Booking not found or cannot be cancelled",
      });
    }

    res.send({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to cancel booking",
    });
  }
});

// =====================================
// ADMIN - GET ALL BOOKINGS
// =====================================

app.get("/admin/bookings", verifyAdmin, async (req, res) => {
  try {
    const bookings = await bookingCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.send({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("Admin get bookings error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch all bookings",
    });
  }
});

// =====================================
// ADMIN - CONFIRM PENDING BOOKING
// =====================================

app.patch("/bookings/:id/confirm", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const result = await bookingCollection.updateOne(
      {
        _id: new ObjectId(id),
        status: "pending",
      },
      {
        $set: {
          status: "confirmed",
          confirmedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Pending booking not found",
      });
    }

    res.send({
      success: true,
      message: "Booking confirmed successfully",
    });
  } catch (error) {
    console.error("Confirm booking error:", error);

    res.status(500).send({
      success: false,
      message: "Failed to confirm booking",
    });
  }
});

// =====================================
// MONGODB CONNECTION & SERVER START
// =====================================

async function connectToMongoDB() {
  try {
    await client.connect();

    const database = client.db("wanderlast");

    destinationCollection = database.collection("destinations");
    bookingCollection = database.collection("bookings");

    await bookingCollection.createIndex({
      userId: 1,
      createdAt: -1,
    });

    console.log("Successfully connected to MongoDB!");

    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB Connection Failed:", error);
    process.exit(1);
  }
}

connectToMongoDB();
