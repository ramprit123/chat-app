import express from "express";
import dotenv from "dotenv";
import { connectMongo } from "./lib/mongo";
import { redisClient } from "./lib/redis";
import { rabbitmq } from "./lib/rabbitmq";
import { emailService } from "./lib/emailService";
import { EmailModel } from "./models/email.model";
import { globalErrorHandler, notFoundHandler } from "./middleware/errorHandler";

dotenv.config();

const PORT = process.env.PORT || 3001;
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

    // Verify email service connection
    if (emailService.isReady()) {
      await emailService.verifyConnection();
    }

    // basic health route
    app.get("/health", async (req, res) => {
      const rabbitHealth = await rabbitmq.healthCheck();
      const emailHealth = emailService.isReady()
        ? await emailService.verifyConnection()
        : false;

      res.json({
        service: "email",
        status: "running",
        timestamp: new Date().toISOString(),
        connections: {
          mongo: !!(await Promise.resolve(true)),
          redis: redisClient.status || "unknown",
          rabbitmq: rabbitHealth ? "connected" : "disconnected",
          gmail: emailHealth ? "connected" : "disconnected",
        },
      });
    });

    // example route: version
    app.get("/", (req, res) => {
      res.json({
        service: "email",
        message: "Hello from email service",
        emailServiceReady: emailService.isReady(),
      });
    });

    // Start email queue consumer
    await startEmailConsumer();

    app.listen(PORT, () => {
      console.log(`🚀 Email service listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start service:", err);
    process.exit(1);
  }
}

// Email queue consumer for background processing
async function startEmailConsumer() {
  const success = await rabbitmq.consume("email_queue", async (payload) => {
    console.log("📧 Email worker received:", payload);

    try {
      const { emailId, to, subject, text, html, type } = payload;

      // Find the email record
      const email = await EmailModel.findById(emailId);
      if (!email) {
        console.error(`❌ Email record not found: ${emailId}`);
        return;
      }

      // Skip if already sent
      if (email.status === "sent") {
        console.log(`✅ Email ${emailId} already sent, skipping`);
        return;
      }

      // Increment retry count
      email.retryCount += 1;

      let success = false;

      // Send email based on type
      switch (type) {
        case "welcome":
          // Extract userName from payload or email body
          const userName = payload.userName || "User";
          success = await emailService.sendWelcomeEmail(to, userName);
          break;

        case "password-reset":
          const resetToken = payload.resetToken || "";
          const userNameReset = payload.userName || "User";
          success = await emailService.sendPasswordResetEmail(
            to,
            userNameReset,
            resetToken
          );
          break;

        case "notification":
          const message =
            payload.message || text || "You have a new notification";
          const userNameNotif = payload.userName || "User";
          success = await emailService.sendNotificationEmail(
            to,
            userNameNotif,
            message
          );
          break;

        default:
          // Custom email
          success = await emailService.sendEmail({ to, subject, text, html });
          break;
      }

      // Update email status
      if (success) {
        email.status = "sent";
        email.sentAt = new Date();
        console.log(`✅ Email sent successfully: ${emailId}`);
      } else {
        email.status = "failed";
        email.errorMessage = "Failed to send email via Gmail";
        console.error(`❌ Failed to send email: ${emailId}`);

        // Retry logic (max 3 attempts)
        if (email.retryCount < 3) {
          console.log(
            `🔄 Retrying email ${emailId} (attempt ${email.retryCount + 1}/3)`
          );
          // Re-queue for retry after 5 minutes
          setTimeout(async () => {
            await rabbitmq.publish("email_queue", payload);
          }, 5 * 60 * 1000);
        }
      }

      await email.save();
    } catch (error) {
      console.error("❌ Error processing email queue message:", error);

      // Update email record if possible
      if (payload.emailId) {
        try {
          await EmailModel.findByIdAndUpdate(payload.emailId, {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
            $inc: { retryCount: 1 },
          });
        } catch (updateError) {
          console.error("Failed to update email record:", updateError);
        }
      }
    }
  });

  if (success) {
    console.log("✅ Email queue consumer started successfully");
  } else {
    console.warn(
      "⚠️  Failed to start email queue consumer - RabbitMQ not available"
    );
  }
}

start();

import emailRoutes from "./routes/email.routes";
app.use("/emails", emailRoutes);

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
