import { describe, expect, it, vi } from "vitest";
import { createMockHandler } from "./index.js";
import { http } from "msw";

// Mock the msw module
vi.mock("msw", async (importOriginal) => {
  const mod = await importOriginal<typeof import("msw")>();
  return {
    ...mod,
    // replace some exports
    HttpResponse: { json: vi.fn() },
    http: {
      get: vi.fn((uri, handler) => handler()),
      post: vi.fn((uri, handler) => handler()),
    },
  };
});

describe("[createMockHandler] Parts of the module setup", () => {
  it("should return an object with a mock property", () => {
    const mockHandler = createMockHandler({
      mocks: {
        "/api/test/GET": Promise.resolve({ default: {} }),
        "/api/test/POST": Promise.resolve({ default: {} }),
      },
    });
    expect(mockHandler).toHaveProperty("mock");
  });

  it("should return an object with get and post methods", () => {
    const { mock } = createMockHandler({
      mocks: {
        "/api/test/GET": Promise.resolve({ default: {} }),
        "/api/test/POST": Promise.resolve({ default: {} }),
      },
    });
    expect(mock).toHaveProperty("get");
    expect(mock).toHaveProperty("post");
  });

  it("should return a function", () => {
    const { mock } = createMockHandler({
      mocks: {
        "/api/test/GET": Promise.resolve({ default: {} }),
        "/api/test/POST": Promise.resolve({ default: {} }),
      },
    });
    expect(typeof mock.get).toBe("function");
    expect(typeof mock.post).toBe("function");
  });
});

describe("[createMocksRequest] Mocks functionality", () => {
  it("should use the correct mock for the given path", async () => {
    const mockData = { test: "value" };
    const mocks = {
      "/api/test/GET": Promise.resolve({ default: mockData }),
      "/api/test/POST": Promise.resolve({ default: mockData }),
    };

    const { mock } = createMockHandler({ mocks });
    await mock.get("/api/test");
    await mock.post("/api/test");

    expect(http.get).toHaveBeenCalledWith("/api/test", expect.any(Function));
    expect(http.post).toHaveBeenCalledWith("/api/test", expect.any(Function));
  });

  it("should intercept on specific URI with the setted origin", () => {
    const mocks = {
      "/api/test/GET": Promise.resolve({ default: {} }),
    };
    const origin = "https://api.example.com";
    const path = "/api/test";

    const { mock } = createMockHandler({ mocks, origin });
    mock.get(path);

    expect(http.get).toHaveBeenCalledWith(`${origin}${path}`, expect.any(Function));
  });

  it("should call the modifier function with the mock data", async () => {
    const expected = { test: "value" };
    const mocks = {
      "/api/test/GET": Promise.resolve({ default: expected }),
    };
    const modifier = vi.fn((data: any) => data);

    await vi.waitFor(async () => {
      const { mock } = createMockHandler({ mocks });
      await mock.get("/api/test", modifier);
    });

    expect(modifier).toHaveBeenCalledTimes(1);
    expect(modifier).toHaveBeenCalledWith(expected);
  });

  it("should log an info message when debug is true and the mock exists", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const mocks = {
      "/api/test/GET": Promise.resolve({ default: {} }),
    };

    await vi.waitFor(async () => {
      const { mock } = createMockHandler({ mocks, debug: true });
      await mock.get("/api/test");
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith('[mocks-to-msw] Mock file was loaded. [GET]: "/api/test"');
    consoleInfoSpy.mockClear();
  });

  it("should log an error message when debug is true and the mock doesn't exist", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mocks = {
      "/api/test/GET": Promise.reject(new Error("Test error")),
    };

    const { mock } = createMockHandler({ mocks, debug: true });
    await mock.get("/api/test");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[mocks-to-msw] Mock file was not found. [GET]: "/api/test"',
      new Error("Test error")
    );
    consoleErrorSpy.mockClear();
  });
});
