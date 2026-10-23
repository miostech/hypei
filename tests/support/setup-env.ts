import "dotenv/config";

process.env.APP_ENV = "development";
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "silent";
process.env.TEST_DATABASE_URL ??= "postgresql://kabrun:kabrun@localhost:5432/kabrun_test?schema=public";
