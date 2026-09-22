import "dotenv/config";

process.env.APP_ENV = "development";
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL ?? "silent";
process.env.TEST_DATABASE_URL ??= "postgresql://hypei:hypei@localhost:5432/hypei_test?schema=public";
