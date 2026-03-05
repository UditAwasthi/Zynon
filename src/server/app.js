import express from "express";
import bcrypt from "bcryptjs";
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
import followRoutes from "../routes/social/follow.routes.js";
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/follow", followRoutes);
app.get("/", (req, res) => {
   res.json({ message: "API running 🚀" });
});
app.get("/cpu-test", async (req, res) => {
  const start = Date.now();

  await bcrypt.hash("benchmark", 12);

  res.json({ durationMs: Date.now() - start });
});

/* =========================
   Global Error Handler
========================= */

app.use(errorHandler);

export default app;