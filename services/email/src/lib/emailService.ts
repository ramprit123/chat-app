import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const gmailUser = process.env.GMAIL_USER;
      const gmailPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailUser || !gmailPassword) {
        console.warn(
          "⚠️  Gmail credentials not configured. Email service will be disabled."
        );
        console.warn("   Set GMAIL_USER and GMAIL_APP_PASSWORD in .env file");
        return;
      }

      // Try App Password first, fallback to OAuth2 if configured
      const authConfig: any = {
        user: gmailUser,
      };

      // Check if OAuth2 credentials are provided
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        // Use OAuth2
        authConfig.type = "OAuth2";
        authConfig.clientId = clientId;
        authConfig.clientSecret = clientSecret;
        authConfig.refreshToken = refreshToken;
        console.log("🔐 Using OAuth2 authentication for Gmail");
      } else if (gmailPassword) {
        // Use App Password
        authConfig.pass = gmailPassword;
        console.log("🔑 Using App Password authentication for Gmail");
      } else {
        throw new Error("No valid authentication method configured");
      }

      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: authConfig,
      });

      this.isConfigured = true;
      console.log("✅ Email service configured with Gmail");
    } catch (error) {
      console.error("❌ Failed to configure email service:", error);
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log("✅ Gmail SMTP connection verified");
      return true;
    } catch (error) {
      console.error("❌ Gmail SMTP connection failed:", error);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      console.warn("📧 Email service not configured. Cannot send email.");
      return false;
    }

    try {
      const mailOptions = {
        from: options.from || process.env.GMAIL_USER,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully:", info.messageId);
      console.log("📧 Recipients:", mailOptions.to);
      console.log("📝 Subject:", mailOptions.subject);

      return true;
    } catch (error) {
      console.error("❌ Failed to send email:", error);
      return false;
    }
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<boolean> {
    const subject = "Welcome to Chat App!";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Chat App! 🎉</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Thank you for joining our chat application! We're excited to have you on board.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #555; margin-top: 0;">Getting Started:</h3>
          <ul style="color: #666;">
            <li>Complete your profile setup</li>
            <li>Join your first chat room</li>
            <li>Connect with other users</li>
          </ul>
        </div>
        
        <p>If you have any questions, feel free to reach out to our support team.</p>
        
        <p>Happy chatting! 💬</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
          This email was sent from Chat App. If you didn't create an account, please ignore this email.
        </p>
      </div>
    `;

    const text = `
      Welcome to Chat App!
      
      Hi ${userName},
      
      Thank you for joining our chat application! We're excited to have you on board.
      
      Getting Started:
      - Complete your profile setup
      - Join your first chat room
      - Connect with other users
      
      If you have any questions, feel free to reach out to our support team.
      
      Happy chatting!
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password?token=${resetToken}`;

    const subject = "Password Reset Request - Chat App";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request 🔐</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>We received a request to reset your password for your Chat App account.</p>
        
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
          <p style="margin: 0;"><strong>Click the button below to reset your password:</strong></p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="margin: 0; font-size: 14px; color: #666;">
            Or copy and paste this link: <br>
            <a href="${resetUrl}">${resetUrl}</a>
          </p>
        </div>
        
        <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
          This email was sent from Chat App. For security reasons, never share this email with others.
        </p>
      </div>
    `;

    const text = `
      Password Reset Request - Chat App
      
      Hi ${userName},
      
      We received a request to reset your password for your Chat App account.
      
      Click this link to reset your password: ${resetUrl}
      
      Important: This link will expire in 1 hour for security reasons.
      
      If you didn't request this password reset, please ignore this email.
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  async sendNotificationEmail(
    to: string,
    userName: string,
    message: string
  ): Promise<boolean> {
    const subject = "New Notification - Chat App";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Notification 🔔</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>You have a new notification from Chat App:</p>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;">${message}</p>
        </div>
        
        <p>
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" 
             style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Open Chat App
          </a>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #888; font-size: 12px;">
          You can manage your notification preferences in your account settings.
        </p>
      </div>
    `;

    const text = `
      New Notification - Chat App
      
      Hi ${userName},
      
      You have a new notification: ${message}
      
      Visit Chat App: ${process.env.FRONTEND_URL || "http://localhost:3000"}
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  isReady(): boolean {
    return this.isConfigured && this.transporter !== null;
  }
}

export const emailService = new EmailService();
