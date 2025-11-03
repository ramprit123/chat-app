import amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://admin:password@localhost:5672";
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

export const rabbitmq = {
  conn: null as any,
  channel: null as any,
  isConnected: false,
  retryCount: 0,

  async init() {
    return this.connectWithRetry();
  },

  async connectWithRetry() {
    while (this.retryCount < MAX_RETRIES) {
      try {
        console.log(
          `Attempting to connect to RabbitMQ... (attempt ${
            this.retryCount + 1
          }/${MAX_RETRIES})`
        );

        this.conn = await amqp.connect(RABBITMQ_URL);
        this.channel = await this.conn.createChannel();

        // Set up connection event handlers
        this.conn.on("error", (err: any) => {
          console.error("RabbitMQ connection error:", err);
          this.isConnected = false;
        });

        this.conn.on("close", () => {
          console.warn("RabbitMQ connection closed");
          this.isConnected = false;
          this.reconnect();
        });

        this.channel.on("error", (err: any) => {
          console.error("RabbitMQ channel error:", err);
        });

        this.isConnected = true;
        this.retryCount = 0;
        console.log("✅ Successfully connected to RabbitMQ");
        return true;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.retryCount++;

        if (this.retryCount >= MAX_RETRIES) {
          console.error(
            `❌ Failed to connect to RabbitMQ after ${MAX_RETRIES} attempts:`,
            errorMessage
          );
          console.warn(
            "Service will continue in degraded mode without RabbitMQ"
          );
          return false;
        }

        console.warn(
          `RabbitMQ connection failed (attempt ${this.retryCount}/${MAX_RETRIES}):`,
          errorMessage
        );
        console.log(`Retrying in ${RETRY_DELAY}ms...`);
        await this.delay(RETRY_DELAY);
      }
    }
    return false;
  },

  async reconnect() {
    if (!this.isConnected) {
      console.log("Attempting to reconnect to RabbitMQ...");
      this.retryCount = 0;
      await this.delay(1000); // Wait 1 second before reconnecting
      await this.connectWithRetry();
    }
  },

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.conn || !this.channel) {
        return false;
      }

      // Try to assert a temporary queue to test connection
      await this.channel.assertQueue("health-check-temp", {
        durable: false,
        autoDelete: true,
        exclusive: true,
      });

      return this.isConnected;
    } catch (err) {
      console.warn("RabbitMQ health check failed:", err);
      this.isConnected = false;
      return false;
    }
  },

  async assertQueue(name: string) {
    if (!this.isConnected || !this.channel) {
      console.warn(`Cannot assert queue '${name}': RabbitMQ not connected`);
      return false;
    }

    try {
      await this.channel.assertQueue(name, { durable: true });
      return true;
    } catch (err) {
      console.error(`Failed to assert queue '${name}':`, err);
      return false;
    }
  },

  async publish(queue: string, content: any) {
    if (!this.isConnected || !this.channel) {
      console.warn(
        `Cannot publish to queue '${queue}': RabbitMQ not connected. Message dropped.`
      );
      return false;
    }

    try {
      const success = this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(content)),
        { persistent: true }
      );

      if (!success) {
        console.warn(
          `Failed to publish message to queue '${queue}': Queue buffer full`
        );
      }

      return success;
    } catch (err) {
      console.error(`Error publishing to queue '${queue}':`, err);
      return false;
    }
  },

  async consume(queue: string, handler: (payload: any) => Promise<void>) {
    if (!this.isConnected || !this.channel) {
      console.warn(
        `Cannot consume from queue '${queue}': RabbitMQ not connected`
      );
      return false;
    }

    try {
      await this.channel.assertQueue(queue, { durable: true });

      await this.channel.consume(queue, async (msg: any) => {
        if (!msg || !this.channel) return;

        try {
          const payload = JSON.parse(msg.content.toString());
          await handler(payload);
          this.channel.ack(msg);
        } catch (err) {
          console.error(`Error processing message from queue '${queue}':`, err);
          if (this.channel) {
            // Reject and don't requeue on processing error
            this.channel.nack(msg, false, false);
          }
        }
      });

      console.log(`✅ Started consuming from queue: ${queue}`);
      return true;
    } catch (err) {
      console.error(`Failed to start consuming from queue '${queue}':`, err);
      return false;
    }
  },

  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }
      this.isConnected = false;
      console.log("RabbitMQ connection closed");
    } catch (err) {
      console.error("Error closing RabbitMQ connection:", err);
    }
  },
};
