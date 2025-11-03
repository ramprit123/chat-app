import express from "express";
import dotenv from "dotenv";
import { connectMongo } from "./lib/mongo";
import { redisClient } from "./lib/redis";
import { rabbitmq } from "./lib/rabbitmq";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// connect resources
async function start() {
  try {
    await connectMongo();
    await redisClient.connect().catch((err) => {
      console.warn("Redis connect warning:", err.message || err);
    });
    await rabbitmq.init();

    // basic health route
    app.get("/health", async (req, res) => {
      const rabbitHealth = await rabbitmq.healthCheck();

      res.json({
        service: "chat",
        status: "running",
        timestamp: new Date().toISOString(),
        connections: {
          mongo: !!(await Promise.resolve(true)),
          redis: redisClient.status || "unknown",
          rabbitmq: rabbitHealth ? "connected" : "disconnected",
        },
      });
    });

    // example route: version
    app.get("/", (req, res) => {
      res.json({ service: "chat", message: "Hello from chat service" });
    });

    // service-specific routes (imported)
    // routes are located under src/routes/

    app.listen(PORT, () => {
      console.log('Service "chat" listening on port', PORT);
    });
  } catch (err) {
    console.error("Failed to start service:", err);
    process.exit(1);
  }
}

start();

import chatRoutes from "./routes/chat.routes";
app.use("/chats", chatRoutes);

// Global error handling middleware (must be last)
app.all("*", notFoundHandler);
app.use(globalErrorHandler);

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  console.error("🚨 UNHANDLED PROMISE REJECTION! 💥 Shutting down...");
  console.error("Error:", err.name, err.message);
  console.error("Stack:", err.stack);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("🚨 UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.error("Error:", err.name, err.message);
  console.error("Stack:", err.stack);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 SIGINT RECEIVED. Shutting down gracefully");
  process.exit(0);
});
