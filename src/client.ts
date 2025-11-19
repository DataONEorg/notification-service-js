/**
 * @file Notification client for the DataONE Notification Service API.
 * @since 0.0.1
 */

import ky, { type KyInstance, type Options as KyOptions } from "ky";

/**
 * Default allowed resource types for the Notification Service API.
 */
const DEFAULT_TYPES = Object.freeze(["datasetChanges", "citations"] as const);

/**
 * Error messages used throughout the notification client for exception handling.
 */
const ERROR_MESSAGES = Object.freeze({
  prefixUrl: "prefixUrl is required",
  getToken: "A getToken function is required",
  validatePID: "validatePID must be a function",
  resourceTypes: "resourceTypes must be a non-empty array of strings",
  resourceType: "Invalid resource type",
  noPid: "PID is required",
  invalidPid: "PID is invalid",
  noToken: "Token is required",
} as const);

/**
 * Allowed HTTP methods used by the notification client to enforce method types.
 */
const HTTP_METHODS = Object.freeze({
  GET: "GET",
  POST: "POST",
  DELETE: "DELETE",
} as const);

/**
 * Endpoint definitions for the Notification Service API. The key is the method
 * name on the client, and the value is the corresponding endpoint path.
 */
export const ENDPOINTS = Object.freeze({
  subscribe: {
    endpoint: "{resource}/{pid}",
    method: HTTP_METHODS.POST,
  },
  unsubscribe: {
    endpoint: "{resource}/{pid}",
    method: HTTP_METHODS.DELETE,
  },
  getSubscriptionsByPid: {
    endpoint: "pid/{pid}",
    method: HTTP_METHODS.GET,
  },
  getSubscriptionsByType: {
    endpoint: "{resource}",
    method: HTTP_METHODS.GET,
  },
  ping: {
    endpoint: "metrics/ping",
    method: HTTP_METHODS.GET,
  },
} as const);

/**
 * Represents the allowed HTTP methods as a type.
 */
type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

/**
 * Function type that returns an authentication token, possibly asynchronously.
 */
type TokenSupplier = () => string | null | undefined | Promise<string | null | undefined>;

/**
 * Function type to validate a PID, possibly asynchronously.
 */
type PidValidator = (pid: string) => boolean | Promise<boolean>;

/**
 * Options for Ky requests used internally, omitting method, prefixUrl, and headers
 * as these are managed by the notification client.
 */
export type KyRequestOptions = Omit<KyOptions, "method" | "prefixUrl" | "headers">;

/**
 * Internal request options passed to the request method, extending KyRequestOptions
 * with required metadata like resource type and HTTP method.
 */
interface InternalRequestOptions extends KyRequestOptions {
  methodName: keyof typeof ENDPOINTS;
  resource: ResourceDefinition;
}

/**
 * Configuration options for creating an instance of NotificationClient.
 */
export interface NotificationClientOptions {
  prefixUrl: string;
  getToken: TokenSupplier;
  validatePID?: PidValidator;
  resourceTypes?: ReadonlyArray<string>;
  kyOptions?: KyOptions;
  kyInstance?: KyInstance;
}

/**
 * Shape of the subscription response returned when subscribing to notifications.
 */
interface SubscriptionResponse {
  resourceIds: string[];
  resourceType: string;
  subject: string;
}

/** Shape of the ping response returned by the notification service. */
interface PingResponse {
  status: string;
}

/**
 * Definition for a resource to subscribe or unsubscribe from, or to retrieve
 * subscriptions for. Includes a PID and optional (in some cases) resource type.
 */
export interface ResourceDefinition {
  pid: string;
  resourceType: string;
}

/**
 * NotificationClient provides methods to subscribe, unsubscribe, and retrieve
 * subscriptions for resources, handling authentication and request validation.
 */
export class NotificationClient {
  private readonly prefixUrl: string;
  private readonly getToken: TokenSupplier;
  private readonly validatePID: PidValidator;
  private readonly resourceTypes: Set<string>;
  private readonly ky: KyInstance;

  constructor({
    prefixUrl,
    getToken,
    validatePID,
    resourceTypes = DEFAULT_TYPES,
    kyOptions = {},
    kyInstance,
  }: NotificationClientOptions) {
    // Validate prefixUrl is provided
    if (!prefixUrl) throw new TypeError(ERROR_MESSAGES.prefixUrl);
    // Validate getToken is a function
    if (typeof getToken !== "function") throw new TypeError(ERROR_MESSAGES.getToken);

    // Validate validatePID if provided is a function
    if (validatePID && typeof validatePID !== "function") {
      throw new TypeError(ERROR_MESSAGES.validatePID);
    }
    // Normalize and validate resource types array
    const normalizedTypes = this.normalizeResourceTypes(resourceTypes);
    if (normalizedTypes.length === 0) {
      throw new TypeError(ERROR_MESSAGES.resourceTypes);
    }

    // Remove trailing slashes from prefixUrl
    this.prefixUrl = prefixUrl.replace(/\/+$/, "");
    this.getToken = getToken;
    // Use provided validatePID or default to always true
    this.validatePID = validatePID ?? (() => true);
    this.resourceTypes = new Set(normalizedTypes);
    // Use provided kyInstance or create a new one with prefixUrl and options
    this.ky =
      kyInstance ??
      ky.create({
        prefixUrl: this.prefixUrl,
        ...kyOptions,
      });
  }

  /**
   * Subscribe to notifications for a given PID and resource type.
   * @param resource - The resource object containing pid and optional resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscription response or undefined.
   */
  subscribe(
    resource: ResourceDefinition,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>({
      methodName: "subscribe",
      resource,
      ...options,
    });
  }

  /**
   * Unsubscribe from notifications for a given PID and resource type.
   * @param resource - The resource object containing pid and resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving when the operation completes.
   */
  async unsubscribe(
    resource: ResourceDefinition,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>({
      methodName: "unsubscribe",
      resource,
      ...options,
    });
  }

  /**
   * Retrieve subscriptions for a given resource type.
   * @param resource - The resource object containing pid and resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscriptions or undefined.
   */
  getSubscriptionsByPid(
    resource: ResourceDefinition,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>({
      methodName: "getSubscriptionsByPid",
      resource,
      ...options,
    });
  }

  /**
   * Retrieve subscriptions for a given resource type.
   * @param resource - The resource object containing pid and resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscriptions or undefined.
   */
  getSubscriptionsByType(
    resource: ResourceDefinition,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>({
      methodName: "getSubscriptionsByType",
      resource,
      ...options,
    });
  }

  /**
   * Ping the notification service to check its availability.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the ping response or undefined.
   */
  ping(options: KyRequestOptions = {}): Promise<PingResponse | undefined> {
    return this.request<PingResponse>({
      methodName: "ping",
      resource: { pid: "", resourceType: "" },
      ...options,
    });
  }

  private async request<T = unknown>({
    methodName,
    resource,
    ...rest
  }: InternalRequestOptions): Promise<T | undefined> {
    const { resourceType, pid } = resource ?? {};
    // Normalize inputs
    const normalizedResourceType: string = resourceType?.trim() ?? "";
    const normalizedPid: string = pid?.trim() ?? "";

    // Validate inputs based on endpoint requirements
    this.validateInput(methodName, normalizedResourceType, normalizedPid);
    // If no error, proceed with the request

    // Get authentication token, always required
    const token = await Promise.resolve(this.getToken());
    if (!token) throw new Error(ERROR_MESSAGES.noToken);

    // Construct the endpoint
    const endpoint = this.constructEndpoint(methodName, normalizedResourceType, normalizedPid);
    const method = this.getHTTPMethod(methodName);

    // Make the request using ky
    const response = await this.ky(endpoint, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      ...rest,
    });

    if ([204, 205, 304].includes(response.status)) {
      return undefined;
    }

    return (await response.json()) as T;
  }

  private normalizeResourceTypes(resourceTypes: ReadonlyArray<string>): string[] {
    return Array.from(
      new Set(resourceTypes.map((type) => type.trim()).filter((type) => type.length > 0)),
    );
  }

  private validateInput(
    methodName: keyof typeof ENDPOINTS,
    resourceType: string,
    pid: string,
  ): void {
    const endpointConfig = ENDPOINTS[methodName];
    const resourceTypeRequired: boolean = endpointConfig.endpoint.includes("{resource}");
    const pidRequired: boolean = endpointConfig.endpoint.includes("{pid}");

    if (resourceTypeRequired) {
      if (!resourceType) throw new Error(ERROR_MESSAGES.resourceType);
      if (!this.resourceTypes.has(resourceType)) throw new Error(ERROR_MESSAGES.resourceType);
    }

    if (pidRequired) {
      if (!pid) throw new Error(ERROR_MESSAGES.noPid);
      const isValidPid = this.validatePID(pid);
      if (isValidPid instanceof Promise) {
        isValidPid.then((valid) => {
          if (!valid) throw new Error(ERROR_MESSAGES.invalidPid);
        });
      } else if (!isValidPid) {
        throw new Error(ERROR_MESSAGES.invalidPid);
      }
    }
  }

  private constructEndpoint(
    methodName: keyof typeof ENDPOINTS,
    resourceType?: string,
    pid?: string,
  ): string {
    let endpoint: string = ENDPOINTS[methodName].endpoint;
    endpoint = endpoint.replace(/\{resource\}/g, encodeURIComponent(resourceType ?? ""));
    endpoint = endpoint.replace(/\{pid\}/g, encodeURIComponent(pid ?? ""));
    return endpoint;
  }

  private getHTTPMethod(methodName: keyof typeof ENDPOINTS): HttpMethod {
    return ENDPOINTS[methodName].method;
  }
}

export default NotificationClient;
