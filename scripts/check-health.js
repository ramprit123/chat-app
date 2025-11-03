#!/usr/bin/env node

const http = require("http");

const services = [
  { name: "User Service", url: "http://localhost:3000/health" },
  { name: "Chat Service", url: "http://localhost:3001/health" },
  { name: "Email Service", url: "http://localhost:3002/health" },
];

async function checkHealth(service) {
  return new Promise((resolve) => {
    const req = http.get(service.url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const health = JSON.parse(data);
          resolve({ ...service, status: "healthy", health });
        } catch (err) {
          resolve({
            ...service,
            status: "unhealthy",
            error: "Invalid JSON response",
          });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ ...service, status: "unreachable", error: err.message });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ...service, status: "timeout", error: "Request timeout" });
    });
  });
}

async function main() {
  console.log("🔍 Checking service health...\n");

  const results = await Promise.all(services.map(checkHealth));

  results.forEach((result) => {
    const statusIcon = result.status === "healthy" ? "✅" : "❌";
    console.log(`${statusIcon} ${result.name}: ${result.status}`);

    if (result.health) {
      const { connections } = result.health;
      console.log(`   MongoDB: ${connections.mongo ? "✅" : "❌"}`);
      console.log(
        `   Redis: ${connections.redis === "ready" ? "✅" : "❌"} (${
          connections.redis
        })`
      );
      console.log(
        `   RabbitMQ: ${connections.rabbitmq === "connected" ? "✅" : "❌"} (${
          connections.rabbitmq
        })`
      );
    } else if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log("");
  });

  const healthyCount = results.filter((r) => r.status === "healthy").length;
  console.log(`📊 Summary: ${healthyCount}/${results.length} services healthy`);
}

main().catch(console.error);
