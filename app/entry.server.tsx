import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import {
  type EntryContext,
  type HandleDataRequestFunction,
} from "react-router";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";

export const streamTimeout = 5000;

const handleRequest = async (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext
) => {
  addDocumentResponseHeaders(request, responseHeaders);
  // Every page is live Shopify data for one merchant. Nothing between this
  // server and the admin iframe (browser cache, proxy, back/forward cache)
  // may hand back an earlier copy of it.
  responseHeaders.set("Cache-Control", "no-store");
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? '')
    ? "onAllReady"
    : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      }
    );

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000);
  });
};
export default handleRequest;

// Loader and action responses (`*.data`) carry the same data without the
// HTML. The client fetches them on every navigation and revalidation, and
// each one must come from Shopify, never from a cache.
export const handleDataRequest: HandleDataRequestFunction = (response) => {
  response.headers.set("Cache-Control", "no-store");
  return response;
};
