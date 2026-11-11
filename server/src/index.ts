import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { startScheduledPublishWorker } from "@/features/scheduling/publish-worker";
import { warmUp } from "@/lib/warm-up";

import { createApp } from "./app";

const app = createApp();

// Open the connection pool before accepting traffic, so the first request
// doesn't pay for the TCP/auth handshake.
await prisma.$connect();

// Compile the hot query plans before taking traffic.
await warmUp();

if (env.SCHEDULED_PUBLISH_WORKER) {
  startScheduledPublishWorker();
}

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received - shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
