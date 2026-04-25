require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const compression = require("compression");
const adminRoutes = require("./src/modules/Admin/route");
const categoryRoutes = require("./src/modules/Category/route");
const productRoutes = require("./src/modules/Product/route");
const orderRoutes = require("./src/modules/Order/route");
const userRoutes = require("./src/modules/User/route");
const settingRoutes = require("./src/modules/Setting/route");
const uploadRoutes = require("./src/modules/Upload/route");
const deliveryZoneRoutes = require("./src/modules/DeliveryZone/route");

// Initializing express application
const app = express();

// CORS configuration
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    allowedHeaders: "Content-Type,Authorization",
  })
);

const port = process.env.PORT || 8000;

// Middleware
app.use(compression());
app.use(morgan("dev"));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "src", "uploads")));

// MongoDB connection string building (Exactly like SevaBazar)
const mongoUri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("Connected to MongoDB Atlas (AnsariMart)");
  })
  .catch((err) => console.error("Could not connect to MongoDB", err));

// Basic Route
app.get("/", (req, res) => {
  res.send("AnsariMart Backend is running...");
});

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/delivery-zones", deliveryZoneRoutes);

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://0.0.0.0:${port}`);
});
