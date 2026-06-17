---
name: api-mock-server
description: Stand up a mock HTTP API with canned responses for local development and tests.
when_to_use: Use when mocking, stubbing, or faking an HTTP API for local testing.
when_not_to_use: Do not use to author production API handlers or database migrations.
examples:
  - mock a REST endpoint that returns sample users
  - stub an API so my tests do not hit the network
  - fake a webhook receiver locally
  - serve canned json responses for development
tags: [api, http, testing, mock, stub]
version: 1.0.0
license: Apache-2.0
requires:
  code_execution: true
---

# api-mock-server

Run a tiny HTTP server that returns predictable responses so you can develop and
test against an API that does not exist yet (or that you want to isolate from).

## Steps

1. Define routes and their canned responses (status, headers, JSON body).
2. Start a minimal server (Node `http`, Python `http.server`, or a tool like
   `json-server`/`mockoon`).
3. Point your client at the mock's base URL.
4. Add latency or error responses to test failure handling.
5. Assert your code's behavior against each canned case.

## Example

```js
import { createServer } from "node:http";
createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ users: [{ id: 1, name: "Ada" }] }));
}).listen(3000);
```
