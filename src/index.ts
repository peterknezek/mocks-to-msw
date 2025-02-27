import { http, HttpResponse } from "msw";

type SupportedMethods = Extract<keyof typeof http, "get" | "post">;
type Method = Uppercase<SupportedMethods>;

/**
 * Function with can be modified the response data.
 */
type ModifierFn<R> = (json: R) => any;

const createMocksRequest =
  (options: CreateMockHandlerOptions) =>
  <Res>(method: Method, pathname: string, modifier?: ModifierFn<Res>) => {
    const { loader, debug, origin } = options;
    const getMock = async () => {
      try {
        const data = await loader(`${pathname}/${method}`);
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

    if (method === "GET") {
      return http.get(url, getMock);
    }
    if (method === "POST") {
      return http.post(url, getMock);
    }
  };

const createMockNamespace = (options: CreateMockHandlerOptions) => {
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
    get: (uri, modifier?) => mocksRequest("GET", uri, modifier),
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
    post: (uri, modifier?) => mocksRequest("POST", uri, modifier),
  } satisfies Record<
    SupportedMethods,
    <ResponseType extends Record<string, any>>(
      uri: string,
      modifier?: ModifierFn<ResponseType>
    ) => ReturnType<typeof mocksRequest>
  >;
};

interface CreateMockHandlerOptions {
  /**
   * A function that loads a mock file by the given path.
   * @example
   * ```ts
   * const loader = (path) => require(`.${path}.json`)
   * ```
   */
  loader: (path: string) => any;
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
 * const { mock } = createMockHandler({
 *  loader: (path) => require(`.${path}.json`)
 * })
 * ```
 */
export const createMockHandler = (options: CreateMockHandlerOptions) => ({
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
