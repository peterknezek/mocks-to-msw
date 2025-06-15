/* v8 ignore start */
import { createMockHandler } from "./index.js";

// Define mock data imports
const mocks = {
  "/api/user/GET": import("./GET.json"),
  "/uniq/POST": import("./GET.json"),
} as const;

// Create mock handler with type checking
const { mock } = createMockHandler({
  mocks,
  debug: true,
});

// Define response types
interface User {
  id: string;
  name: string;
  email: string;
}

// Valid mock calls - these will pass type checking
mock.get<User>("/api/user"); // OK: matches GET method
mock.post("/uniq"); // OK: matches POST method

// Invalid mock calls - these will show type errors
// mock.get("/uniq"); // Error: "/uniq" is only for POST
// mock.post("/api/user"); // Error: "/api/user" is only for GET

// Example with response modifier
mock.get<User>("/api/user", (user) => ({
  ...user,
  name: user.name.toUpperCase(),
}));

/* v8 ignore stop */
