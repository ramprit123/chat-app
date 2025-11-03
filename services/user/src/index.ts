import express from "express";
import dotenv from "dotenv";
import { connectMongo } from "./lib/mongo";
import { redisClient } from "./lib/redis";
import { rabbitmq } from "./lib/rabbitmq";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

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
        service: "user",
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
      res.json({ service: "user", message: "Hello from user service" });
    });

    // service-specific routes (imported)
    // routes are located under src/routes/

    app.listen(PORT, () => {
      console.log('Service "user" listening on port', PORT);
    });
  } catch (err) {
    console.error("Failed to start service:", err);
    process.exit(1);
  }
}

start();

// register routes
import userRoutes from "./routes/user.routes";
app.use("/users", userRoutes);
