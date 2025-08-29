import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(",") || [
      "http://localhost:5173",
      "https://grr-agents.vercel.app",
    ],
    credentials: true,
  });

  // Set global prefix for API routes
  app.setGlobalPrefix("api");

  // Get port from environment or default to 3000
  const port = process.env.PORT || 3000;

  // Listen on all interfaces for cloud deployment
  await app.listen(port, "0.0.0.0");
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(
    `MongoDB URI configured: ${process.env.MONGODB_URI ? "Yes" : "No"}`,
  );
}

bootstrap();
