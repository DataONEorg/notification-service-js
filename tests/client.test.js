import { describe, it, expect, vi, afterEach } from "vitest";
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

  it("subscribes to a PID and returns the subscription response", async () => {
    const subscription = {
      resourceIds: ["pid-123"],
      resourceType: "datasetChanges",
      subject: "user-1",
    };
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(subscription),
    };
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
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(subscription),
    };
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
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(subscription),
    };
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
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(responseBody),
    };
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
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(subscriptions),
    };
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

  it("throws at request time when an authenticated call has no token supplier", async () => {
    const kyMock = vi.fn();
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      kyInstance: kyMock,
    });

    await expect(client.subscribe(resource)).rejects.toThrowError("Token is required");
    expect(kyMock).not.toHaveBeenCalled();
  });

  it("pings the notification service", async () => {
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue({ status: "ok" }),
    };
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
      headers: { Authorization: "Bearer async-token" },
    });
    expect(result).toEqual({ status: "ok" });
    expect(getToken).toHaveBeenCalledTimes(1);
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
