import { env } from "./src/config/env";

console.log("Environment loaded successfully");
console.log("Port:", env.port);
console.log("Database Host:", new URL(env.databaseUrl).host);
console.log("Frontend URL:", env.frontendAppUrl);
