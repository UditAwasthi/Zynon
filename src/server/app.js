import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { errorHandler } from "../middleware/errorHandler.js";

const app = express();

/* =========================
   Global Middlewares
========================= */

// Allow ANY origin (dev mode) while supporting cookies
app.use(cors({
   origin: function (origin, callback) {
      // Allow requests without origin (Postman, curl)
      if (!origin) return callback(null, true);

      // Reflect request origin (allow all)
      return callback(null, true);
   },
   credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* =========================
   Routes
========================= */
import authRoutes from "../routes/auth.routes.js";
import profileRoutes from "../routes/profile.routes.js";

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
   res.json({ message: "API running 🚀" });
});

/* =========================
   Global Error Handler
========================= */

app.use(errorHandler);

export default app;