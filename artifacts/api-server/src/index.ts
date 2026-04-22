import app from "./app";
import { logger } from "./lib/logger";
import { pool, runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  // Run any unapplied DB migrations before accepting traffic.
  try {
    const report = await runMigrations(pool);
    if (report.applied.length > 0) {
      logger.info({ applied: report.applied, skipped: report.skipped }, "Migrations applied");
    } else {
      logger.info({ skipped: report.skipped }, "Migrations up to date");
    }
  } catch (err) {
    logger.error({ err }, "Migration failed — aborting startup");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

start().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
