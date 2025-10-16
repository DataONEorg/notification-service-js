import { describe, it, expect, vi, afterEach } from "vitest";
import { NotificationClient } from "../src/client.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NotificationClient", () => {
  it("instantiates a client", () => {
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken: () => "token-123",
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

    const result = await client.subscribe("pid-123", "datasetChanges");

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-123", {
      method: "POST",
      headers: { Authorization: "Bearer token-123" },
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(subscription);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes from a PID using the DELETE method", async () => {
    const response = {
      status: 204,
      json: vi.fn(),
    };
    const kyMock = vi.fn().mockResolvedValue(response);
    const getToken = vi.fn(() => "token-abc");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    const result = await client.unsubscribe("pid-999", "datasetChanges");

    expect(kyMock).toHaveBeenCalledWith("datasetChanges/pid-999", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-abc" },
    });
    expect(result).toBeUndefined();
  });

  it("fetches subscriptions for a resource type", async () => {
    const subscriptions = [
      { resourceId: "pid-1", subject: "user-1" },
      { resourceId: "pid-2", subject: "user-2" },
    ];
    const response = {
      status: 200,
      json: vi.fn().mockResolvedValue(subscriptions),
    };
    const kyMock = vi.fn().mockResolvedValue(response);
    const getToken = vi.fn(() => "token-xyz");
    const client = new NotificationClient({
      prefixUrl: "https://api.example.org/v1/",
      getToken,
      kyInstance: kyMock,
    });

    const result = await client.getSubscriptions("datasetChanges");

    expect(kyMock).toHaveBeenCalledWith("datasetChanges", {
      method: "GET",
      headers: { Authorization: "Bearer token-xyz" },
    });
    expect(response.json).toHaveBeenCalledTimes(1);
    expect(result).toEqual(subscriptions);
  });
});
