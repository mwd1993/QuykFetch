/**
 * QuykFetch
 * A lightweight, class-based HTTP client built on top of fetch().
 *
 * Features:
 * - Class-based API
 * - Shared defaults + per-request overrides
 * - Query param serialization
 * - Timeout support
 * - Auto JSON body serialization
 * - Auto response parsing
 * - Clean normalized errors
 * - Lightweight request/response/error hooks
 *
 * Browser-first, but works anywhere fetch is available.
 */

class QuykFetchError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "QuykFetchError";

    this.status = details.status ?? null;
    this.statusText = details.statusText ?? "";
    this.url = details.url ?? "";
    this.method = details.method ?? "";
    this.data = details.data;
    this.headers = details.headers ?? {};
    this.cause = details.cause ?? null;
    this.isTimeout = details.isTimeout ?? false;
    this.isAbort = details.isAbort ?? false;
  }
}

class QuykFetchResponse {
  constructor({ ok, status, statusText, url, headers, data, raw }) {
    this.ok = ok;
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.headers = headers;
    this.data = data;
    this.raw = raw;
  }
}

class QuykFetch {
  constructor(options = {}) {
    this.defaults = {
      baseURL: "",
      headers: {},
      timeout: 15000,
      responseType: "auto",
      parseErrorBody: true,
      hooks: {
        beforeRequest: null,
        afterResponse: null,
        onError: null
      },
      ...options
    };

    this.defaults.headers = { ...(options.headers || {}) };
    this.defaults.hooks = {
      beforeRequest: options.hooks?.beforeRequest || null,
      afterResponse: options.hooks?.afterResponse || null,
      onError: options.hooks?.onError || null
    };
  }

  setHeader(key, value) {
    this.defaults.headers[key] = value;
    return this;
  }

  removeHeader(key) {
    delete this.defaults.headers[key];
    return this;
  }

  setToken(token, type = "Bearer") {
    this.defaults.headers.Authorization = `${type} ${token}`;
    return this;
  }

  clearToken() {
    delete this.defaults.headers.Authorization;
    return this;
  }

  extend(options = {}) {
    return new QuykFetch({
      ...this.defaults,
      ...options,
      headers: {
        ...this.defaults.headers,
        ...(options.headers || {})
      },
      hooks: {
        ...this.defaults.hooks,
        ...(options.hooks || {})
      }
    });
  }

  async get(url, options = {}) {
    return this.request({ ...options, url, method: "GET" });
  }

  async delete(url, options = {}) {
    return this.request({ ...options, url, method: "DELETE" });
  }

  async head(url, options = {}) {
    return this.request({ ...options, url, method: "HEAD" });
  }

  async options(url, options = {}) {
    return this.request({ ...options, url, method: "OPTIONS" });
  }

  async post(url, data, options = {}) {
    return this.request({ ...options, url, method: "POST", body: data });
  }

  async put(url, data, options = {}) {
    return this.request({ ...options, url, method: "PUT", body: data });
  }

  async patch(url, data, options = {}) {
    return this.request({ ...options, url, method: "PATCH", body: data });
  }

  async request(options = {}) {
    const config = this.#mergeConfig(options);
    const method = (config.method || "GET").toUpperCase();
    const finalURL = this.#buildURL(config.baseURL, config.url, config.params);

    const { body, headers } = this.#prepareBodyAndHeaders(config.body, config.headers);

    const controller = new AbortController();
    const signals = [controller.signal, config.signal].filter(Boolean);
    const signal = this.#mergeSignals(signals);

    const timeoutId = this.#createTimeout(controller, config.timeout);

    let requestConfig = {
      method,
      headers,
      body,
      signal,
      credentials: config.credentials,
      mode: config.mode,
      cache: config.cache,
      redirect: config.redirect,
      referrer: config.referrer,
      integrity: config.integrity,
      keepalive: config.keepalive
    };

    requestConfig = this.#stripUndefined(requestConfig);

    if (typeof config.hooks.beforeRequest === "function") {
      const modified = await config.hooks.beforeRequest({
        url: finalURL,
        options: { ...requestConfig }
      });

      if (modified && typeof modified === "object") {
        if (modified.url) {
          requestConfig.url = modified.url;
        }
        if (modified.options && typeof modified.options === "object") {
          requestConfig = { ...requestConfig, ...modified.options };
        }
      }
    }

    const requestURL = requestConfig.url || finalURL;
    delete requestConfig.url;

    try {
      const rawResponse = await fetch(requestURL, requestConfig);
      clearTimeout(timeoutId);

      const parsedHeaders = this.#headersToObject(rawResponse.headers);
      const parsedData = await this.#parseResponse(rawResponse, config.responseType);

      const response = new QuykFetchResponse({
        ok: rawResponse.ok,
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        url: rawResponse.url,
        headers: parsedHeaders,
        data: parsedData,
        raw: rawResponse
      });

      if (!rawResponse.ok) {
        throw new QuykFetchError(
          `Request failed with status ${rawResponse.status}`,
          {
            status: rawResponse.status,
            statusText: rawResponse.statusText,
            url: rawResponse.url,
            method,
            data: parsedData,
            headers: parsedHeaders
          }
        );
      }

      if (typeof config.hooks.afterResponse === "function") {
        const modifiedResponse = await config.hooks.afterResponse(response);
        return modifiedResponse ?? response;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      const normalizedError = await this.#normalizeError(error, {
        url: requestURL,
        method,
        timeout: config.timeout,
        parseErrorBody: config.parseErrorBody
      });

      if (typeof config.hooks.onError === "function") {
        const hookResult = await config.hooks.onError(normalizedError);
        if (hookResult !== undefined) {
          return hookResult;
        }
      }

      throw normalizedError;
    }
  }

  #mergeConfig(options) {
    return {
      ...this.defaults,
      ...options,
      headers: {
        ...this.defaults.headers,
        ...(options.headers || {})
      },
      hooks: {
        ...this.defaults.hooks,
        ...(options.hooks || {})
      }
    };
  }

  #buildURL(baseURL = "", url = "", params) {
    const full = this.#joinURL(baseURL, url);
    if (!params || typeof params !== "object") {
      return full;
    }

    const query = this.#serializeParams(params);
    if (!query) {
      return full;
    }

    return full.includes("?") ? `${full}&${query}` : `${full}?${query}`;
  }

  #joinURL(baseURL, url) {
    if (!baseURL) return url;
    if (!url) return baseURL;

    const cleanBase = baseURL.replace(/\/+$/, "");
    const cleanURL = url.replace(/^\/+/, "");

    return `${cleanBase}/${cleanURL}`;
  }

  #serializeParams(params) {
    const search = new URLSearchParams();

    const appendValue = (key, value) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        for (const item of value) {
          appendValue(key, item);
        }
        return;
      }

      if (value instanceof Date) {
        search.append(key, value.toISOString());
        return;
      }

      if (typeof value === "object") {
        search.append(key, JSON.stringify(value));
        return;
      }

      search.append(key, String(value));
    };

    for (const [key, value] of Object.entries(params)) {
      appendValue(key, value);
    }

    return search.toString();
  }

  #prepareBodyAndHeaders(body, headers = {}) {
    if (body === undefined || body === null) {
      return { body: undefined, headers };
    }

    const normalizedHeaders = { ...headers };
    const hasContentType = this.#hasHeader(normalizedHeaders, "Content-Type");
    const hasAccept = this.#hasHeader(normalizedHeaders, "Accept");

    if (body instanceof FormData) {
      return { body, headers: normalizedHeaders };
    }

    if (body instanceof URLSearchParams) {
      if (!hasContentType) {
        normalizedHeaders["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      }
      return { body: body.toString(), headers: normalizedHeaders };
    }

    if (
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      ArrayBuffer.isView(body)
    ) {
      return { body, headers: normalizedHeaders };
    }

    if (typeof body === "string") {
      if (!hasContentType) {
        normalizedHeaders["Content-Type"] = "text/plain;charset=UTF-8";
      }
      return { body, headers: normalizedHeaders };
    }

    if (typeof body === "object") {
      if (!hasContentType) {
        normalizedHeaders["Content-Type"] = "application/json;charset=UTF-8";
      }
      if (!hasAccept) {
        normalizedHeaders["Accept"] = "application/json";
      }

      return {
        body: JSON.stringify(body),
        headers: normalizedHeaders
      };
    }

    return { body, headers: normalizedHeaders };
  }

  async #parseResponse(response, responseType = "auto") {
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    if (responseType === "raw") {
      return response;
    }

    if (responseType === "json") {
      return this.#safeJson(response);
    }

    if (responseType === "text") {
      return response.text();
    }

    if (responseType === "blob") {
      return response.blob();
    }

    if (responseType === "arrayBuffer") {
      return response.arrayBuffer();
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return this.#safeJson(response);
    }

    if (
      contentType.startsWith("text/") ||
      contentType.includes("application/xml") ||
      contentType.includes("text/html")
    ) {
      return response.text();
    }

    return response.blob();
  }

  async #safeJson(response) {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async #normalizeError(error, context) {
    if (error instanceof QuykFetchError) {
      return error;
    }

    if (error?.name === "AbortError") {
      const isTimeoutAbort = context.timeout != null;

      return new QuykFetchError(
        isTimeoutAbort
          ? `Request timed out after ${context.timeout}ms`
          : "Request was aborted",
        {
          url: context.url,
          method: context.method,
          cause: error,
          isTimeout: isTimeoutAbort,
          isAbort: !isTimeoutAbort
        }
      );
    }

    return new QuykFetchError(error?.message || "Network request failed", {
      url: context.url,
      method: context.method,
      cause: error
    });
  }

  #createTimeout(controller, timeout) {
    if (!timeout || timeout <= 0) {
      return null;
    }

    return setTimeout(() => {
      controller.abort();
    }, timeout);
  }

  #headersToObject(headers) {
    const result = {};
    for (const [key, value] of headers.entries()) {
      result[key] = value;
    }
    return result;
  }

  #hasHeader(headers, targetKey) {
    const lower = targetKey.toLowerCase();
    return Object.keys(headers).some((key) => key.toLowerCase() === lower);
  }

  #stripUndefined(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined)
    );
  }

  #mergeSignals(signals) {
    if (signals.length === 0) return undefined;
    if (signals.length === 1) return signals[0];

    const controller = new AbortController();

    const abort = () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };

    for (const signal of signals) {
      if (signal.aborted) {
        abort();
        break;
      }
      signal.addEventListener("abort", abort, { once: true });
    }

    return controller.signal;
  }
}
