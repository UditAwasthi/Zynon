import "../config/env.js";   // MUST be first

import app from "./app.js";
import connectDB from "../db/index.js";

const PORT = process.env.PORT || 3000;

/* =========================
   Start Server
========================= */
const startServer = async () => {
    try {
        await connectDB();

        const server = app.listen(PORT, () => {
            console.log(`🎶😎Server running on port ${PORT}`);
        });

        /* =========================
           Graceful Shutdown
        ========================== */
        process.on("SIGTERM", () => {
            console.log("SIGTERM received. Shutting down gracefully...");
            server.close(() => {
                console.log("Server closed.");
                process.exit(0);
            });
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();

/* =========================
   Unhandled Promise Rejection
========================= */
process.on("unhandledRejection", (err) => {
    console.error("Unhandled Rejection:", err.message);
    process.exit(1);
});