import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "MadPlan Backend API is running!";
  }

  getHealth(): object {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "madplan-backend",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      database: process.env.MONGODB_URI ? "connected" : "not configured",
    };
  }
}
