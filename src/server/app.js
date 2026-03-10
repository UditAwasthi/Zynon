import express from "express";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import cors from "cors";
import { errorHandler } from "../middleware/errorHandler.js";

const app = express();

/* =========================
   Global Middlewares
========================= */
//working code 
const allowedOrigins = [
  "https://zynon-next-js-website.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",

];

app.use(cors({
  origin: function (origin, callback) {
    // allow server-to-server tools like Postman
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
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
import postRoutes from "../routes/content/post.routes.js";
import chatRoutes from "../routes/chat/chat.routes.js"
app.use("/api/chat", chatRoutes);
app.use("/api/content", postRoutes);
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