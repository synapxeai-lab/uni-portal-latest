// Services throw AuthError for permission failures; the error middleware maps
// it to 401/403. Route-level guards live in middleware/auth.ts.
export { AuthError } from "@/http/errors";
