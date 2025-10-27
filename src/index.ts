import { http, HttpResponse } from "msw";

type SupportedMethods = Extract<keyof typeof http, "get" | "post" | "put" | "delete">;
type Method = Uppercase<SupportedMethods>;
type Path = `${string}/${Method}`;

/**
 * Extracts the base URL from a path by removing the method suffix
 */
type ExtractBaseUrl<T extends Path> = T extends `${infer U}/${Method}` ? U : never;

/**
 * Maps methods to their allowed paths
 */
type MethodToPath<P extends Path> = {
  [M in Method]: ExtractBaseUrl<Extract<P, `${string}/${M}`>>;
};

/**
 * Function with can be modified the response data.
 */
type ModifierFn<R> = (json: R) => any;

type MockImport = Promise<{ default: any }>;

type MocksRequestReturn = ReturnType<typeof http.get>;

const createMocksRequest =
  <P extends Path>(options: CreateMockHandlerOptions<P>) =>
  <Res>(method: Method, pathname: string, modifier?: ModifierFn<Res>) => {
    const { mocks, debug, origin } = options;
    const getMock = async () => {
      try {
        const mockPath = `${pathname}/${method}` as P;
        const data = await mocks[mockPath].then((res) => res.default);
        if (debug) {
          console.info(`[mocks-to-msw] Mock file was loaded. [${method}]: "${pathname}"`);
        }
        if (typeof modifier === "function") {
          return HttpResponse.json(modifier(data));
        }
        return HttpResponse.json(data);
      } catch (error) {
        if (debug) {
          console.error(`[mocks-to-msw] Mock file was not found. [${method}]: "${pathname}"`, error);
        }
      }
    };

    // Construct the URL from the given pathname and domain.
    const url = ((): string => {
      if (origin) {
        try {
          return new URL(pathname, origin).href;
        } catch (e) {
          if (debug) {
            console.error(
              `[mocks-to-msw] Invalid URL. The provided option for a createMockHandler, the URL's origin, has the issue. Values: [origin]: "${origin}" [pathname]: "${pathname}"`,
              e
            );
          }
          return pathname;
        }
      }
      return pathname;
    })();

    switch (method) {
      case "GET":
        return http.get(url, getMock);
      case "POST":
        return http.post(url, getMock);
      case "PUT":
        return http.put(url, getMock);
      case "DELETE":
        return http.delete(url, getMock);
      default:
        throw new Error(`Invalid method: ${method satisfies never}`);
    }
  };

type MockNamespace<P extends Path> = {
  get: <ResponseType = Record<string, any>>(
    uri: MethodToPath<P>["GET"],
    modifier?: ModifierFn<ResponseType>
  ) => MocksRequestReturn;
  post: <ResponseType = Record<string, any>>(
    uri: MethodToPath<P>["POST"],
    modifier?: ModifierFn<ResponseType>
  ) => MocksRequestReturn;
  put: <ResponseType = Record<string, any>>(
    uri: MethodToPath<P>["PUT"],
    modifier?: ModifierFn<ResponseType>
  ) => MocksRequestReturn;
  delete: <ResponseType = Record<string, any>>(
    uri: MethodToPath<P>["DELETE"],
    modifier?: ModifierFn<ResponseType>
  ) => MocksRequestReturn;
};

const createMockNamespace = <P extends Path>(options: CreateMockHandlerOptions<P>): MockNamespace<P> => {
  const mocksRequest = createMocksRequest(options);
  return {
    /**
     * Mocks a GET request to the given URI.
     * @param uri The URI to intercept.
     * @param modifier A function that modifies the response data.
     * @example
     * ```ts
     * mock.get('/api/user')
     * mock.get('/api/user', (json) => ({ ...json, data: 'modified' }))
     * ```
     */
    get: <ResponseType = Record<string, any>>(uri: MethodToPath<P>["GET"], modifier?: ModifierFn<ResponseType>) =>
      mocksRequest("GET", uri, modifier),
    /**
     * Mocks a POST request to the given URI.
     * @param uri The URI to intercept.
     * @param modifier A function that modifies the response data.
     * @example
     * ```ts
     * mock.post('/api/user')
     * mock.post('/api/user', (json) => ({ ...json, data: 'modified' }))
     * ```
     */
    post: <ResponseType = Record<string, any>>(uri: MethodToPath<P>["POST"], modifier?: ModifierFn<ResponseType>) =>
      mocksRequest("POST", uri, modifier),
    /**
     * Mocks a PUT request to the given URI.
     * @param uri The URI to intercept.
     * @param modifier A function that modifies the response data.
     * @example
     * ```ts
     * mock.put('/api/user')
     * mock.put('/api/user', (json) => ({ ...json, data: 'modified' }))
     * ```
     */
    put: <ResponseType = Record<string, any>>(uri: MethodToPath<P>["PUT"], modifier?: ModifierFn<ResponseType>) =>
      mocksRequest("PUT", uri, modifier),
    /**
     * Mocks a DELETE request to the given URI.
     * @param uri The URI to intercept.
     * @param modifier A function that modifies the response data.
     * @example
     * ```ts
     * mock.delete('/api/user')
     * mock.delete('/api/user', (json) => ({ ...json, data: 'modified' }))
     * ```
     */
    delete: <ResponseType = Record<string, any>>(uri: MethodToPath<P>["DELETE"], modifier?: ModifierFn<ResponseType>) =>
      mocksRequest("DELETE", uri, modifier),
  };
};

interface CreateMockHandlerOptions<Paths extends Path> {
  /**
   * A record of mock imports for each path.
   * @example
   * ```ts
   * const mocks = {
   *   '/api/user/GET': import('./api/user/GET.json'),
   *   '/api/user/POST': import('./api/user/POST.json'),
   * } as const;
   * ```
   */
  mocks: Record<Paths, MockImport>;
  /**
   * A flag to enable debug logs.
   */
  debug?: boolean;
  /**
   * Origin of the URL, that is its scheme, its domain and its port.
   * @example "https://api.example.com"
   */
  origin?: string;
}

/**
 * Creates a mock handler with the given options.
 * @param options The options to create a mock handler.
 * @example
 * ```ts
 * const mocks = {
 *   '/api/user/GET': import('./api/user/GET.json'),
 *   '/api/user/POST': import('./api/user/POST.json'),
 * } as const;
 *
 * const { mock } = createMockHandler<keyof typeof mocks>({
 *   mocks,
 * });
 * ```
 */
export const createMockHandler = <P extends Path>(options: CreateMockHandlerOptions<P>) => ({
  /**
   * A namespace to intercept and mock HTTP requests.
   *
   * @example
   * ```ts
   * mock.get('/api')
   * mock.post('/api/:id', modifier)
   * ```
   */
  mock: createMockNamespace(options),
});
