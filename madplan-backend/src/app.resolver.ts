import { Resolver, Query } from "@nestjs/graphql";

@Resolver()
export class AppResolver {
  @Query(() => String)
  hello(): string {
    return "Hello World from MadPlan GraphQL API!";
  }

  @Query(() => String)
  health(): string {
    return JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "madplan-backend-graphql",
      version: "1.0.0",
    });
  }
}
