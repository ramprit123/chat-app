import { Router } from 'express';
import { EmailModel } from '../models/email.model';
import { rabbitmq } from '../lib/rabbitmq';
import { emailService } from "../lib/emailService";

const router = Router();

// Send email directly (synchronous)
router.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html, type = "custom" } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        error: "Missing required fields: to, subject",
      });
    }

    // Save email to database
    const email = await EmailModel.create({
      to,
      subject,
      body: text || html,
      status: "queued",
      type,
    });

    // Try to send email immediately
    const success = await emailService.sendEmail({ to, subject, text, html });

    if (success) {
      email.status = "sent";
      email.sentAt = new Date();
    } else {
      email.status = "failed";
    }

    await email.save();

    res.status(success ? 200 : 500).json({
      id: email._id,
      status: email.status,
      message: success ? "Email sent successfully" : "Failed to send email",
    });
  } catch (error) {
    console.error("Error in /send route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Queue email for background processing
router.post("/queue", async (req, res) => {
  try {
    const { to, subject, text, html, type = "custom" } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        error: "Missing required fields: to, subject",
      });
    }

    const email = await EmailModel.create({
      to,
      subject,
      body: text || html,
      status: "queued",
      type,
    });

    // Publish to RabbitMQ for background processing
    const published = await rabbitmq.publish("email_queue", {
      emailId: email._id.toString(),
      to,
      subject,
      text,
      html,
      type,
    });

    if (!published) {
      email.status = "failed";
      await email.save();
      return res.status(500).json({
        error: "Failed to queue email - RabbitMQ unavailable",
      });
    }

    res.status(202).json({
      id: email._id,
      status: "queued",
      message: "Email queued for processing",
    });
  } catch (error) {
    console.error("Error in /queue route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send welcome email
router.post("/welcome", async (req, res) => {
  try {
    const { to, userName } = req.body;

    if (!to || !userName) {
      return res.status(400).json({
        error: "Missing required fields: to, userName",
      });
    }

    const email = await EmailModel.create({
      to,
      subject: "Welcome to Chat App!",
      body: `Welcome ${userName}!`,
      status: "queued",
      type: "welcome",
    });

    const success = await emailService.sendWelcomeEmail(to, userName);

    if (success) {
      email.status = "sent";
      email.sentAt = new Date();
    } else {
      email.status = "failed";
    }

    await email.save();

    res.status(success ? 200 : 500).json({
      id: email._id,
      status: email.status,
      message: success
        ? "Welcome email sent successfully"
        : "Failed to send welcome email",
    });
  } catch (error) {
    console.error("Error in /welcome route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send password reset email
router.post("/password-reset", async (req, res) => {
  try {
    const { to, userName, resetToken } = req.body;

    if (!to || !userName || !resetToken) {
      return res.status(400).json({
        error: "Missing required fields: to, userName, resetToken",
      });
    }

    const email = await EmailModel.create({
      to,
      subject: "Password Reset Request",
      body: `Password reset for ${userName}`,
      status: "queued",
      type: "password-reset",
    });

    const success = await emailService.sendPasswordResetEmail(
      to,
      userName,
      resetToken
    );

    if (success) {
      email.status = "sent";
      email.sentAt = new Date();
    } else {
      email.status = "failed";
    }

    await email.save();

    res.status(success ? 200 : 500).json({
      id: email._id,
      status: email.status,
      message: success
        ? "Password reset email sent successfully"
        : "Failed to send password reset email",
    });
  } catch (error) {
    console.error("Error in /password-reset route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send notification email
router.post("/notification", async (req, res) => {
  try {
    const { to, userName, message } = req.body;

    if (!to || !userName || !message) {
      return res.status(400).json({
        error: "Missing required fields: to, userName, message",
      });
    }

    const email = await EmailModel.create({
      to,
      subject: "New Notification",
      body: message,
      status: "queued",
      type: "notification",
    });

    const success = await emailService.sendNotificationEmail(
      to,
      userName,
      message
    );

    if (success) {
      email.status = "sent";
      email.sentAt = new Date();
    } else {
      email.status = "failed";
    }

    await email.save();

    res.status(success ? 200 : 500).json({
      id: email._id,
      status: email.status,
      message: success
        ? "Notification email sent successfully"
        : "Failed to send notification email",
    });
  } catch (error) {
    console.error("Error in /notification route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get email status
router.get("/:id", async (req, res) => {
  try {
    const email = await EmailModel.findById(req.params.id);

    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }

    res.json({
      id: email._id,
      to: email.to,
      subject: email.subject,
      status: email.status,
      type: email.type,
      createdAt: email.createdAt,
      sentAt: email.sentAt,
    });
  } catch (error) {
    console.error("Error in GET /:id route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all emails (with pagination)
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const emails = await EmailModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("to subject status type createdAt sentAt");

    const total = await EmailModel.countDocuments();

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in GET / route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test email service connection
router.get("/test/connection", async (req, res) => {
  try {
    const isReady = emailService.isReady();
    const isVerified = isReady ? await emailService.verifyConnection() : false;

    res.json({
      configured: isReady,
      verified: isVerified,
      message: isVerified
        ? "Email service is ready"
        : "Email service is not configured or connection failed",
    });
  } catch (error) {
    console.error("Error in /test/connection route:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
