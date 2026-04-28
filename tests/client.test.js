import { describe, it, expect, vi, afterEach } from "vitest";
import ky from "ky";
import { NotificationClient } from "../src/client.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const resource = {
  pid: "pid-123",
  resourceType: "datasetChanges",
};

const resourceTypeRequest = {
  resourceType: "datasetChanges",
};

const jsonResponse = (body, status = 200) => ({
  status,
  json: vi.fn().mockResolvedValue(body),
});

describe("NotificationClient", () => {
  it("instantiates a client", () => {
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-123",
    });

    expect(client).toBeInstanceOf(NotificationClient);
  });

  it("instantiates without a token supplier", () => {
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
    });

    expect(client).toBeInstanceOf(NotificationClient);
  });

  it.each([
    [
      "https://api.example.org/notifications",
      undefined,
      "https://api.example.org/notifications/v1",
    ],
    ["https://api.example.org/notifications/", "v2", "https://api.example.org/notifications/v2"],
    ["https://api.example.org/notifications/", "/v2/", "https://api.example.org/notifications/v2"],
    [
      "https://api.example.org/notifications/v1/",
      undefined,
      "https://api.example.org/notifications/v1",
    ],
    ["https://api.example.org/notifications", false, "https://api.example.org/notifications"],
  ])("resolves prefixUrl with apiVersion", (prefixUrl, apiVersion, expectedPrefixUrl) => {
    const kyCreate = vi.spyOn(ky, "create").mockReturnValue(vi.fn());
    const options = {
      prefixUrl,
    };

    if (apiVersion !== undefined) {
      options.apiVersion = apiVersion;
    }

    new NotificationClient(options);

    expect(kyCreate).toHaveBeenCalledWith({
      prefixUrl: expectedPrefixUrl,
    });
  });

  it("subscribes to a PID and returns the subscription response", async () => {
    const subscription = {
      resourceIds: ["pid-123"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = jsonResponse(subscription);
    const kyMock = vi.fn().mockResolvedValue(response);
    const getToken = vi.fn(() => "token-123");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    const result = await client.subscribe(resource);

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-123", {
      method: "POST",
      headers: { Authorization: "Bearer token-123" },
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(subscription);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("passes additional ky request options through subscribe calls", async () => {
    const subscription = {
      resourceIds: ["pid-123"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = jsonResponse(subscription);
    const kyMock = vi.fn().mockResolvedValue(response);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-123",
      kyInstance: kyMock,
    });

    await client.subscribe(resource, {
      timeout: 10_000,
      retry: { limit: 2 },
    });

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-123", {
      method: "POST",
      headers: { Authorization: "Bearer token-123" },
      timeout: 10_000,
      retry: { limit: 2 },
    });
  });

  it("unsubscribes from a PID using the DELETE method", async () => {
    const subscription = {
      resourceIds: ["pid-123"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = jsonResponse(subscription);
    const kyMock = vi.fn().mockResolvedValue(response);
    const getToken = vi.fn(() => "token-abc");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    const result = await client.unsubscribe(resource);

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-123", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-abc" },
    });
    expect(result).toEqual(subscription);
  });

  it("fetches subscribed resource types for a PID", async () => {
    const responseBody = ["datasetChanges", "citations"];
    const response = jsonResponse(responseBody);
    const kyMock = vi.fn().mockResolvedValue(response);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-456",
      kyInstance: kyMock,
    });

    const result = await client.getResourceTypesByPid({
      pid: "pid-123",
    });

    expect(kyMock).toHaveBeenCalledWith("pid/pid-123", {
      method: "GET",
      headers: { Authorization: "Bearer token-456" },
    });
    expect(result).toEqual(responseBody);
  });

  it("fetches subscriptions for a resource type", async () => {
    const subscriptions = {
      resourceIds: ["pid-1", "pid-2"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = jsonResponse(subscriptions);
    const kyMock = vi.fn().mockResolvedValue(response);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-xyz",
      kyInstance: kyMock,
    });

    const result = await client.getSubscriptionsByType(resourceTypeRequest);

    expect(kyMock).toHaveBeenCalledWith("datasetChanges", {
      method: "GET",
      headers: { Authorization: "Bearer token-xyz" },
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(subscriptions);
  });

  it("sends the canonical resource type for backend requests", async () => {
    const subscription = {
      resourceIds: ["pid-123"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = jsonResponse(subscription);
    const kyMock = vi.fn().mockResolvedValue(response);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-123",
      kyInstance: kyMock,
    });

    await client.subscribe({
      pid: "pid-123",
      resourceType: "DATASET-CHANGES",
    });

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-123", {
      method: "POST",
      headers: { Authorization: "Bearer token-123" },
    });
  });

  it("throws at request time when an authenticated call has no token supplier", async () => {
    const kyMock = vi.fn();
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      kyInstance: kyMock,
    });

    await expect(client.subscribe(resource)).rejects.toThrowError("Token is required");
    expect(kyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["subscribe", (client) => client.subscribe(resource)],
    ["unsubscribe", (client) => client.unsubscribe(resource)],
    ["getResourceTypesByPid", (client) => client.getResourceTypesByPid({ pid: "pid-123" })],
    ["getSubscriptionsByType", (client) => client.getSubscriptionsByType(resourceTypeRequest)],
  ])("requires a non-empty token for %s", async (_methodName, callClient) => {
    const kyMock = vi.fn();
    const getToken = vi.fn(() => "");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    await expect(callClient(client)).rejects.toThrowError("Token is required");
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(kyMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "subscribe missing PID",
      (client) => client.subscribe({ pid: "", resourceType: "datasetChanges" }),
      "PID is required",
    ],
    [
      "lookup blank PID",
      (client) => client.getResourceTypesByPid({ pid: "   " }),
      "PID is required",
    ],
    [
      "subscribe missing resource type",
      (client) => client.subscribe({ pid: "pid-123", resourceType: "" }),
      "Invalid resource type",
    ],
    [
      "list unsupported resource type",
      (client) => client.getSubscriptionsByType({ resourceType: "unsupported" }),
      "Invalid resource type",
    ],
  ])("rejects %s before token lookup or network", async (_caseName, callClient, expectedError) => {
    const kyMock = vi.fn();
    const getToken = vi.fn(() => "token-123");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    await expect(callClient(client)).rejects.toThrowError(expectedError);
    expect(getToken).not.toHaveBeenCalled();
    expect(kyMock).not.toHaveBeenCalled();
  });

  it("awaits async PID validation before making a request", async () => {
    const kyMock = vi.fn();
    const getToken = vi.fn(() => "token-123");
    const validatePID = vi.fn().mockResolvedValue(false);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      validatePID,
      kyInstance: kyMock,
    });

    await expect(client.subscribe(resource)).rejects.toThrowError("PID is invalid");
    expect(validatePID).toHaveBeenCalledWith("pid-123");
    expect(getToken).not.toHaveBeenCalled();
    expect(kyMock).not.toHaveBeenCalled();
  });

  it("pings the notification service", async () => {
    const response = jsonResponse({ status: "ok" });
    const kyMock = vi.fn().mockResolvedValue(response);
    const getToken = vi.fn().mockResolvedValue("async-token");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    const result = await client.ping();

    expect(kyMock).toHaveBeenCalledWith("metrics/ping", {
      method: "GET",
    });
    expect(result).toEqual({ status: "ok" });
    expect(getToken).not.toHaveBeenCalled();
  });

  it("returns undefined for no-content responses without parsing JSON", async () => {
    const response = {
      status: 204,
      json: vi.fn(),
    };
    const kyMock = vi.fn().mockResolvedValue(response);
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-abc",
      kyInstance: kyMock,
    });

    const result = await client.unsubscribe(resource);

    expect(result).toBeUndefined();
    expect(response.json).not.toHaveBeenCalled();
  });

  it("throws when subscribing to an unsupported resource type", async () => {
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token",
      resourceTypes: ["datasetChanges"],
    });

    await expect(
      client.subscribe({
        pid: "pid-987",
        resourceType: "citations",
      }),
    ).rejects.toThrowError("Invalid resource type");
  });
});
