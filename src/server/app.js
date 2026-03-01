import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRoutes from "../routes/auth.routes.js";

import { errorHandler } from "../middleware/errorHandler.js";

const app = express();

/* =========================
   Global Middlewares
========================= */

app.use(cors({
  origin: process.env.CLIENT_URL || "*",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =========================
   Routes
========================= */

app.use("/api/auth", authRoutes);


app.get("/", (req, res) => {
  res.json({ message: "API running 🚀" });
});

/* =========================
   Global Error Handler
========================= */

app.use(errorHandler);

export default app;