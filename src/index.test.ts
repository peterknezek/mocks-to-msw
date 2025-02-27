import { describe, expect, it, vi } from "vitest";
import { createMockHandler } from ".";
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
    const mockHandler = createMockHandler({ loader: vi.fn() });
    expect(mockHandler).toHaveProperty("mock");
  });

  it("should return an object with get and post methods", () => {
    const { mock } = createMockHandler({ loader: vi.fn() });
    expect(mock).toHaveProperty("get");
    expect(mock).toHaveProperty("post");
  });

  it("should return a function", () => {
    const { mock } = createMockHandler({ loader: vi.fn() });
    expect(typeof mock.get).toBe("function");
    expect(typeof mock.post).toBe("function");
  });
});

describe("[createMocksRequest] Loader functionality", () => {
  it("should call the loader function with the correct arguments", () => {
    const require = vi.fn((path: string) => ({}));
    const loader = (path: string) => require(path);

    const { mock } = createMockHandler({ loader });
    mock.get("/api/test");
    mock.post("/api/test");

    expect(require).toHaveBeenCalledTimes(2);
    expect(require).toHaveBeenCalledWith("/api/test/GET");
    expect(require).toHaveBeenCalledWith("/api/test/POST");
    expect(require).toHaveReturnedTimes(2);
    expect(http.get).toHaveBeenCalledWith("/api/test", expect.any(Function));
  });

  it("should insercept on specific URI with the setted origin", () => {
    const require = vi.fn((path: string) => ({}));
    const loader = (path: string) => require(path);
    const origin = "https://api.example.com";
    const path = "/api/test";

    const { mock } = createMockHandler({ loader, origin });
    mock.get(path);

    expect(http.get).toHaveBeenCalledWith(`${origin}${path}`, expect.any(Function));
  });

  it("should call the loader function and return the result to modifier function", async () => {
    const expected = { test: "value" };
    const require = vi.fn((path: string) => expected);
    const loader = (path: string) => require(path);
    const modifier = vi.fn((data: any) => data);

    await vi.waitFor(async () => {
      const { mock } = createMockHandler({ loader });
      mock.get("/api/test", modifier);
    });

    expect(modifier).toHaveBeenCalledTimes(1);
    expect(modifier).toHaveBeenCalledWith(expected);
  });

  it("should log an info message when debug is true and the loader function does not throw an error", async () => {
    const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const require = vi.fn((path: string) => "{}");
    const loader = (path: string) => require(path);

    await vi.waitFor(async () => {
      const { mock } = createMockHandler({ loader, debug: true });
      mock.get("/api/test");
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith('[mocks-to-msw] Mock file was loaded. [GET]: "/api/test"');
    consoleInfoSpy.mockClear();
  });

  it("should log an error message when debug is true and the loader function throws an error", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const require = vi.fn((path: string) => {
      throw new Error("Test error");
    });
    const loader = (path: string) => require(path);

    const { mock } = createMockHandler({ loader, debug: true });
    mock.get("/api/test");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[mocks-to-msw] Mock file was not found. [GET]: "/api/test"',
      new Error("Test error")
    );
    consoleErrorSpy.mockClear();
  });
});
