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
    authRequired: true,
  },
  unsubscribe: {
    endpoint: "{resource}/{pid}",
    method: HTTP_METHODS.DELETE,
    authRequired: true,
  },
  getResourceTypesByPid: {
    endpoint: "pid/{pid}",
    method: HTTP_METHODS.GET,
    authRequired: true,
  },
  getSubscriptionsByType: {
    endpoint: "{resource}",
    method: HTTP_METHODS.GET,
    authRequired: true,
  },
  ping: {
    endpoint: "metrics/ping",
    method: HTTP_METHODS.GET,
    authRequired: false,
  },
} as const);

/**
 * Represents the allowed HTTP methods as a type.
 */
type HttpMethod = (typeof HTTP_METHODS)[keyof typeof HTTP_METHODS];

/**
 * Function type that returns an authentication token, possibly asynchronously.
 */
export type TokenSupplier = () => string | null | undefined | Promise<string | null | undefined>;

/**
 * Function type to validate a PID, possibly asynchronously.
 */
export type PidValidator = (pid: string) => boolean | Promise<boolean>;

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
  resource?: RequestDefinition;
}

/**
 * Configuration options for creating an instance of NotificationClient.
 */
export interface NotificationClientOptions {
  prefixUrl: string;
  getToken?: TokenSupplier;
  apiVersion?: string | false;
  validatePID?: PidValidator;
  resourceTypes?: ReadonlyArray<string>;
  kyOptions?: KyOptions;
  kyInstance?: KyInstance;
}

/**
 * Shape of the subscription response returned when subscribing to notifications.
 */
export interface SubscriptionResponse {
  resourceIds: string[];
  resourceType: string;
  subject: string;
}

/** Shape of the ping response returned by the notification service. */
export interface PingResponse {
  status: string;
}

/**
 * Definition for a resource to subscribe or unsubscribe from.
 */
export interface SubscriptionTarget {
  pid: string;
  resourceType: string;
}

/** Definition for a resource-type-scoped subscription query. */
export interface ResourceTypeRequest {
  resourceType: string;
}

/** Definition for a PID-scoped subscription query. */
export interface PidRequest {
  pid: string;
}

/** Shape returned when querying subscribed resource types for a PID. */
export type ResourceTypesByPidResponse = string[];

type RequestDefinition = Partial<SubscriptionTarget>;

interface ValidatedRequestDefinition {
  resourceType: string;
  pid: string;
}

/**
 * NotificationClient provides methods to subscribe, unsubscribe, and retrieve
 * subscriptions for resources, handling authentication and request validation.
 */
export class NotificationClient {
  private readonly prefixUrl: string;
  private readonly getToken?: TokenSupplier;
  private readonly validatePID: PidValidator;
  private readonly resourceTypes: Map<string, string>;
  private readonly ky: KyInstance;

  constructor({
    prefixUrl,
    getToken,
    apiVersion = "v1",
    validatePID,
    resourceTypes = DEFAULT_TYPES,
    kyOptions = {},
    kyInstance,
  }: NotificationClientOptions) {
    // Validate prefixUrl is provided
    if (!prefixUrl) throw new TypeError(ERROR_MESSAGES.prefixUrl);
    // Validate getToken if provided is a function
    if (getToken !== undefined && typeof getToken !== "function") {
      throw new TypeError(ERROR_MESSAGES.getToken);
    }

    // Validate validatePID if provided is a function
    if (validatePID && typeof validatePID !== "function") {
      throw new TypeError(ERROR_MESSAGES.validatePID);
    }
    // Normalize and validate resource types array
    const normalizedTypes = this.normalizeResourceTypes(resourceTypes);
    if (normalizedTypes.size === 0) {
      throw new TypeError(ERROR_MESSAGES.resourceTypes);
    }

    this.prefixUrl = this.resolvePrefixUrl(prefixUrl, apiVersion);
    this.getToken = getToken;
    // Use provided validatePID or default to always true
    this.validatePID = validatePID ?? (() => true);
    this.resourceTypes = normalizedTypes;
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
   * @param resource - The resource object containing pid and resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscription response or undefined.
   */
  subscribe(
    resource: SubscriptionTarget,
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
   * @returns A promise resolving to the subscription response or undefined.
   */
  async unsubscribe(
    resource: SubscriptionTarget,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>({
      methodName: "unsubscribe",
      resource,
      ...options,
    });
  }

  /**
   * Retrieve resource types with active subscriptions for a given PID.
   * @param resource - The resource object containing the pid.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscribed resource type names or undefined.
   */
  getResourceTypesByPid(
    resource: PidRequest,
    options: KyRequestOptions = {},
  ): Promise<ResourceTypesByPidResponse | undefined> {
    return this.request<ResourceTypesByPidResponse>({
      methodName: "getResourceTypesByPid",
      resource,
      ...options,
    });
  }

  /**
   * Retrieve subscriptions for a given resource type.
   * @param resource - The resource object containing resourceType.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscriptions or undefined.
   */
  getSubscriptionsByType(
    resource: ResourceTypeRequest,
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

    const validatedResource = await this.validateInput(
      methodName,
      normalizedResourceType,
      normalizedPid,
    );

    // Construct the endpoint
    const endpoint = this.constructEndpoint(
      methodName,
      validatedResource.resourceType,
      validatedResource.pid,
    );
    const method = this.getHTTPMethod(methodName);

    const requestOptions: KyOptions = {
      ...rest,
      method,
    };
    if (this.isAuthRequired(methodName)) {
      const token = await this.getRequiredToken();
      requestOptions.headers = { Authorization: `Bearer ${token}` };
    }

    // Make the request using ky
    const response = await this.ky(endpoint, requestOptions);

    if ([204, 205, 304].includes(response.status)) {
      return undefined;
    }

    return (await response.json()) as T;
  }

  private resolvePrefixUrl(prefixUrl: string, apiVersion: string | false): string {
    const baseUrl = prefixUrl.replace(/\/+$/, "");
    if (apiVersion === false) {
      return baseUrl;
    }

    if (typeof apiVersion !== "string") {
      throw new TypeError('apiVersion must be a string or false');
    }
    const normalizedVersion = apiVersion.trim().replace(/^\/+|\/+$/g, "");
    if (!normalizedVersion) {
      return baseUrl;
    }

    const lastSegment = baseUrl.substring(baseUrl.lastIndexOf("/") + 1);
    if (lastSegment === normalizedVersion) {
      return baseUrl;
    }

    return `${baseUrl}/${normalizedVersion}`;
  }

  private normalizeResourceTypes(resourceTypes: ReadonlyArray<string>): Map<string, string> {
    const normalizedTypes = new Map<string, string>();

    for (const rawType of resourceTypes) {
      const canonicalType = rawType.trim();
      const normalizedType = this.normalizeResourceTypeKey(canonicalType);
      if (canonicalType && normalizedType && !normalizedTypes.has(normalizedType)) {
        normalizedTypes.set(normalizedType, canonicalType);
      }
    }

    return normalizedTypes;
  }

  private normalizeResourceTypeKey(resourceType: string): string {
    return resourceType.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  }

  private async getRequiredToken(): Promise<string> {
    if (typeof this.getToken !== "function") {
      throw new Error(ERROR_MESSAGES.noToken);
    }

    const token = (await Promise.resolve(this.getToken()))?.trim();
    if (!token) throw new Error(ERROR_MESSAGES.noToken);
    return token;
  }

  private async validateInput(
    methodName: keyof typeof ENDPOINTS,
    resourceType: string,
    pid: string,
  ): Promise<ValidatedRequestDefinition> {
    const endpointConfig = ENDPOINTS[methodName];
    const resourceTypeRequired: boolean = endpointConfig.endpoint.includes("{resource}");
    const pidRequired: boolean = endpointConfig.endpoint.includes("{pid}");
    let canonicalResourceType = resourceType;

    if (resourceTypeRequired) {
      if (!resourceType) throw new Error(ERROR_MESSAGES.resourceType);
      const normalizedResourceType = this.normalizeResourceTypeKey(resourceType);
      const configuredResourceType = this.resourceTypes.get(normalizedResourceType);
      if (!configuredResourceType) throw new Error(ERROR_MESSAGES.resourceType);
      canonicalResourceType = configuredResourceType;
    }

    if (pidRequired) {
      if (!pid) throw new Error(ERROR_MESSAGES.noPid);
      const isValidPid = await Promise.resolve(this.validatePID(pid));
      if (!isValidPid) {
        throw new Error(ERROR_MESSAGES.invalidPid);
      }
    }

    return {
      resourceType: canonicalResourceType,
      pid,
    };
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

  private isAuthRequired(methodName: keyof typeof ENDPOINTS): boolean {
    return ENDPOINTS[methodName].authRequired;
  }
}

export default NotificationClient;
