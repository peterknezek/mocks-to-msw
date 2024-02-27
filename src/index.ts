import { http, HttpResponse } from "msw";

type SupportedMethods = Extract<keyof typeof http, "get" | "post">;
type Method = Uppercase<SupportedMethods>;

/**
 * Function with can be modified the response data.
 */
type ModifierFn<R> = (json: R) => any;

const createMocksRequest =
  (options: CreateMockHandlerOptions) =>
  <Res>(method: Method, uri: string, modifier?: ModifierFn<Res>) => {
    const { loader, debug } = options;
    const getMock = () => {
      try {
        const data = loader(`${uri}/${method}`);
        if (debug) {
          console.info(`[mocks-to-msw] Mock file was loaded. [${method}]: "${uri}"`);
        }
        if (typeof modifier === "function") {
          return HttpResponse.json(modifier(data));
        }
        return HttpResponse.json(data);
      } catch (error) {
        if (debug) {
          console.error(`[mocks-to-msw] Mock file was not found. [${method}]: "${uri}"`, error);
        }
      }
    };

    if (method === "GET") {
      return http.get(uri, getMock);
    }
    if (method === "POST") {
      return http.post(uri, getMock);
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
