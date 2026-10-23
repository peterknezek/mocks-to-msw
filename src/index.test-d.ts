/**
 * Type-level tests. This file is not executed; `bun check` (part of `bun run lint`) type-checks it,
 * and the `@ts-expect-error` lines fail the check if the expected error disappears.
 */
import { createMockHandler } from "./index.js";
import type { components, paths } from "./fixtures/api-schema.js";

type User = components["schemas"]["User"];
type Me = components["schemas"]["Me"];
type Item = components["schemas"]["Item"];
type Application = components["schemas"]["Application"];

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const assertType = <_T extends true>() => {};

const mocks = {
  "/client/GET": Promise.resolve({ default: {} }),
  "/client/application/POST": Promise.resolve({ default: {} }),
  "/users/123/GET": Promise.resolve({ default: {} }),
  "/users/:id/GET": Promise.resolve({ default: {} }),
  "/users/123/DELETE": Promise.resolve({ default: {} }),
  "/users/me/GET": Promise.resolve({ default: {} }),
  "/items/GET": Promise.resolve({ default: {} }),
  "/not/in/schema/GET": Promise.resolve({ default: {} }),
} as const;

/* ---- with an openapi-typescript schema ---------------------------------------------------- */
const { mock } = createMockHandler<keyof typeof mocks, paths>({ mocks });

// exact path, GET 200 → User
mock.get("/client", (user) => {
  assertType<Equal<typeof user, User>>();
  return { ...user, name: user.name.toUpperCase() };
});

// POST 201 → Application
mock.post("/client/application", (app) => {
  assertType<Equal<typeof app, Application>>();
  return app;
});

// a captured value matches the template "/users/{id}" → User
mock.get("/users/123", (user) => {
  assertType<Equal<typeof user, User>>();
  return user;
});

// the MSW parameter form matches the template too → User
mock.get("/users/:id", (user) => {
  assertType<Equal<typeof user, User>>();
  return user;
});

// an exact key beats a template: "/users/me" → Me, not Me | User
mock.get("/users/me", (me) => {
  assertType<Equal<typeof me, Me>>();
  return me;
});

// array response
mock.get("/items", (items) => {
  assertType<Equal<typeof items, Item[]>>();
  return items.slice(0, 1);
});

// 204 without a body → default
mock.delete("/users/123", (json) => {
  assertType<Equal<typeof json, Record<string, any>>>();
  return json;
});

// path missing from the schema → default
mock.get("/not/in/schema", (json) => {
  assertType<Equal<typeof json, Record<string, any>>>();
  return json;
});

// the explicit generic form still works
mock.get<User>("/client", (user) => {
  assertType<Equal<typeof user, User>>();
  return user;
});
mock.get<User>("/client");

// no modifier
mock.get("/client");

// an annotated parameter is an explicit override, like the explicit generic
mock.get("/client", (user: Me) => user);

// a property that does not exist on the schema type is an error
mock.get("/client", (user) => {
  // @ts-expect-error `nope` does not exist on User
  return user.nope;
});

// method and path safety is unchanged
// @ts-expect-error "/client" is only mocked for GET
mock.post("/client");
// @ts-expect-error "/client/application" is only mocked for POST
mock.get("/client/application");
// @ts-expect-error unknown path
mock.get("/nope");

/* ---- without a schema (previous behaviour) ------------------------------------------------- */
const { mock: inferred } = createMockHandler({ mocks });
inferred.get("/client", (json) => {
  assertType<Equal<typeof json, Record<string, any>>>();
  return json;
});
inferred.get<User>("/client", (user) => {
  assertType<Equal<typeof user, User>>();
  return user;
});

const { mock: explicit } = createMockHandler<keyof typeof mocks>({ mocks });
explicit.get("/client", (json) => {
  assertType<Equal<typeof json, Record<string, any>>>();
  return json;
});
// @ts-expect-error "/client" is only mocked for GET
explicit.post("/client");
