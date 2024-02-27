/* v8 ignore start */
import { createMockHandler } from ".";

const { mock } = createMockHandler({ loader: (path) => require(`.${path}.json`), debug: true });
interface User {
  id: string;
  name: string;
  email: string;
}

mock.get<User>("/api/user");
mock.post("/api/user", (json) => ({ ...json, data: "modified" }));

/* v8 ignore stop */
