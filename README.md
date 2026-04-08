# QuykFetch

A lightweight, class-based HTTP client built on top of `fetch()`.

QuykFetch gives you a clean, readable API for sending requests, handling responses, managing headers, parsing data, and normalizing errors without pulling in a heavy dependency.

---

## Features

| Feature | Description |
|---|---|
| Class-based API | Create reusable client instances with shared defaults |
| Lightweight | Small, focused API surface with minimal overhead |
| Built on `fetch()` | Uses the native web standard under the hood |
| Request helpers | Includes `get`, `post`, `put`, `patch`, `delete`, and `request` |
| Shared defaults | Configure `baseURL`, headers, timeout, hooks, and more once |
| Query params | Automatically serializes query parameters |
| Smart body handling | Supports JSON, `FormData`, strings, `URLSearchParams`, blobs, and buffers |
| Auto response parsing | Parses JSON, text, blob, arrayBuffer, or raw responses |
| Normalized errors | Consistent error objects for failed requests |
| Hooks | Lightweight request, response, and error hooks |
| Scalable structure | Clean internals that can grow with your project |

---

## Installation

```bash
npm install quykfetch
```

---

## Quick Example

```javascript
import QuykFetch from "quykfetch";

const api = new QuykFetch({
  baseURL: "https://api.example.com",
  timeout: 10000,
  headers: {
    "X-App": "QuykFetch"
  }
});

const response = await api.get("/users");

console.log(response.status);
console.log(response.data);
```

---

## Basic Usage

### Create a client

```javascript
const api = new QuykFetch({
  baseURL: "https://api.example.com",
  timeout: 15000,
  headers: {
    Accept: "application/json"
  }
});
```

### GET request

```javascript
const response = await api.get("/users");

console.log(response.ok);
console.log(response.status);
console.log(response.data);
```

### GET with query parameters

```javascript
const response = await api.get("/users", {
  params: {
    page: 1,
    search: "JhonDoe",
    tags: ["active", "admin"]
  }
});

console.log(response.data);
```

### POST request

```javascript
const response = await api.post("/users", {
  name: "JhonDoe",
  role: "admin"
});

console.log(response.data);
```

### PUT request

```javascript
const response = await api.put("/users/42", {
  name: "Updated Name"
});
```

### PATCH request

```javascript
const response = await api.patch("/users/42", {
  role: "editor"
});
```

### DELETE request

```javascript
await api.delete("/users/42");
```

### Low-level request

```javascript
const response = await api.request({
  url: "/users",
  method: "GET",
  headers: {
    "X-Debug": "true"
  }
});
```

---

## Response Object

QuykFetch returns a normalized response object.

| Property | Type | Description |
|---|---|---|
| `ok` | `boolean` | Whether the request succeeded |
| `status` | `number` | HTTP status code |
| `statusText` | `string` | HTTP status text |
| `url` | `string` | Final response URL |
| `headers` | `object` | Response headers as a plain object |
| `data` | `any` | Parsed response body |
| `raw` | `Response` | Native fetch response |

```javascript
const response = await api.get("/users");

console.log(response.data);
console.log(response.status);
```

---

## Request Bodies

QuykFetch automatically handles common body types.

| Body Type | Behavior |
|---|---|
| Plain object | Automatically JSON stringified |
| `FormData` | Passed through untouched |
| `URLSearchParams` | Sent as form data |
| `string` | Sent as plain text |
| `Blob` / `ArrayBuffer` | Passed through directly |

### JSON

```javascript
await api.post("/users", {
  name: "JhonDoe",
  email: "JhonDoe@example.com"
});
```

### FormData

```javascript
const form = new FormData();
form.append("avatar", fileInput.files[0]);

await api.post("/upload", form);
```

### URLSearchParams

```javascript
const form = new URLSearchParams();
form.append("email", "JhonDoe@example.com");
form.append("password", "secret");

await api.post("/login", form);
```

---

## Headers

### Default headers

```javascript
const api = new QuykFetch({
  headers: {
    "X-App": "QuykFetch"
  }
});
```

### Per-request headers

```javascript
await api.get("/users", {
  headers: {
    Authorization: "Bearer your_token_here"
  }
});
```

### Header helpers

```javascript
api.setHeader("X-Client", "dashboard");
api.removeHeader("X-Client");
```

---

## Auth Helpers

```javascript
api.setToken("your_token_here");
api.clearToken();
```

You can also provide a custom auth type:

```javascript
api.setToken("your_token_here", "Token");
```

---

## Timeouts

### Set a default timeout

```javascript
const api = new QuykFetch({
  timeout: 10000
});
```

### Override timeout per request

```javascript
await api.get("/reports", {
  timeout: 30000
});
```

---

## Response Types

By default, QuykFetch uses `responseType: "auto"` and parses the response based on its content type.

| Value | Description |
|---|---|
| `auto` | Automatically detect response format |
| `json` | Parse as JSON |
| `text` | Parse as text |
| `blob` | Parse as blob |
| `arrayBuffer` | Parse as array buffer |
| `raw` | Return the raw fetch `Response` object |

```javascript
const response = await api.get("/report.txt", {
  responseType: "text"
});

console.log(response.data);
```

---

## Error Handling

QuykFetch throws normalized errors to make failures easier to handle.

```javascript
try {
  await api.get("/missing-route");
} catch (error) {
  console.log(error.name);
  console.log(error.message);
  console.log(error.status);
  console.log(error.statusText);
  console.log(error.url);
  console.log(error.method);
  console.log(error.data);
}
```

### Error fields

| Property | Description |
|---|---|
| `name` | Error class name |
| `message` | Error message |
| `status` | HTTP status code if available |
| `statusText` | HTTP status text if available |
| `url` | Request URL |
| `method` | Request method |
| `data` | Parsed error response data if available |
| `headers` | Response headers if available |
| `cause` | Original underlying error |
| `isTimeout` | Whether the request timed out |
| `isAbort` | Whether the request was aborted |

---

## Hooks

QuykFetch supports lightweight hooks for request and response flow.

```javascript
const api = new QuykFetch({
  hooks: {
    beforeRequest: ({ url, options }) => {
      console.log("Request:", url, options);
      return { url, options };
    },
    afterResponse: (response) => {
      console.log("Response:", response.status);
      return response;
    },
    onError: (error) => {
      console.error("Request failed:", error);
      throw error;
    }
  }
});
```

---

## Extend a Client

Create a new client from an existing one while preserving defaults.

```javascript
const api = new QuykFetch({
  baseURL: "https://api.example.com",
  headers: {
    Accept: "application/json"
  }
});

const adminApi = api.extend({
  headers: {
    Authorization: "Bearer admin_token"
  }
});
```

---

## Why Use QuykFetch?

QuykFetch is a good fit when you want:

- a cleaner alternative to raw `fetch()`
- reusable API clients
- shared defaults across requests
- automatic parsing and body handling
- better error handling without a large dependency

---

## License

MIT
