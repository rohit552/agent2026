import { app } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./db.js";

const server = app.listen(config.API_PORT, () => {
  console.log(`SkillHeed API listening on port ${config.API_PORT}`);
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`Received ${signal}; shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
