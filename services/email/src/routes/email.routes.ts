import { Router } from 'express';
import { EmailModel } from '../models/email.model';
import { rabbitmq } from '../lib/rabbitmq';
import { emailService } from "../lib/emailService";
import {
  catchAsync,
  ValidationError,
  NotFoundError,
} from "../middleware/errorHandler";

const router = Router();

// Send email directly (synchronous)
router.post(
  "/send",
  catchAsync(async (req, res) => {
    const { to, subject, text, html, type = "custom" } = req.body;

    if (!to || !subject) {
      throw new ValidationError("Missing required fields: to, subject");
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
      status: success ? "success" : "error",
      message: success ? "Email sent successfully" : "Failed to send email",
      data: {
        id: email._id,
        status: email.status,
      },
    });
  })
);

// Queue email for background processing
router.post(
  "/queue",
  catchAsync(async (req, res) => {
    const { to, subject, text, html, type = "custom" } = req.body;

    if (!to || !subject) {
      throw new ValidationError("Missing required fields: to, subject");
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
        status: "error",
        message: "Failed to queue email - RabbitMQ unavailable",
      });
    }

    res.status(202).json({
      status: "success",
      message: "Email queued for processing",
      data: {
        id: email._id,
        status: "queued",
      },
    });
  })
);

// Send welcome email
router.post(
  "/welcome",
  catchAsync(async (req, res) => {
    const { to, userName } = req.body;

    if (!to || !userName) {
      throw new ValidationError("Missing required fields: to, userName");
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
      status: success ? "success" : "error",
      message: success
        ? "Welcome email sent successfully"
        : "Failed to send welcome email",
      data: {
        id: email._id,
        status: email.status,
      },
    });
  })
);

// Send password reset email
router.post(
  "/password-reset",
  catchAsync(async (req, res) => {
    const { to, userName, resetToken } = req.body;

    if (!to || !userName || !resetToken) {
      throw new ValidationError(
        "Missing required fields: to, userName, resetToken"
      );
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
      status: success ? "success" : "error",
      message: success
        ? "Password reset email sent successfully"
        : "Failed to send password reset email",
      data: {
        id: email._id,
        status: email.status,
      },
    });
  })
);

// Send notification email
router.post(
  "/notification",
  catchAsync(async (req, res) => {
    const { to, userName, message } = req.body;

    if (!to || !userName || !message) {
      throw new ValidationError(
        "Missing required fields: to, userName, message"
      );
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
      status: success ? "success" : "error",
      message: success
        ? "Notification email sent successfully"
        : "Failed to send notification email",
      data: {
        id: email._id,
        status: email.status,
      },
    });
  })
);

// Get email status
router.get(
  "/:id",
  catchAsync(async (req, res) => {
    const email = await EmailModel.findById(req.params.id);

    if (!email) {
      throw new NotFoundError("Email not found");
    }

    res.json({
      status: "success",
      data: {
        email: {
          id: email._id,
          to: email.to,
          subject: email.subject,
          status: email.status,
          type: email.type,
          createdAt: email.createdAt,
          sentAt: email.sentAt,
        },
      },
    });
  })
);

// Get all emails (with pagination)
router.get(
  "/",
  catchAsync(async (req, res) => {
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
      status: "success",
      results: emails.length,
      data: {
        emails,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  })
);

// Test email service connection
router.get(
  "/test/connection",
  catchAsync(async (req, res) => {
    const isReady = emailService.isReady();
    const isVerified = isReady ? await emailService.verifyConnection() : false;

    res.json({
      status: "success",
      data: {
        configured: isReady,
        verified: isVerified,
        message: isVerified
          ? "Email service is ready"
          : "Email service is not configured or connection failed",
      },
    });
  })
);

export default router;