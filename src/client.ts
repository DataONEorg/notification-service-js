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
  resourceType: string;
  method?: HttpMethod;
  pidRequired?: boolean;
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
   * @param pid - The persistent identifier to subscribe to.
   * @param resourceType - The type of resource to subscribe to.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscription response or undefined.
   */
  subscribe(
    pid: string,
    resourceType: string,
    options: KyRequestOptions = {},
  ): Promise<SubscriptionResponse | undefined> {
    return this.request<SubscriptionResponse>(pid, {
      resourceType,
      method: HTTP_METHODS.POST,
      pidRequired: true,
      ...options,
    });
  }

  /**
   * Unsubscribe from notifications for a given PID and resource type.
   * @param pid - The persistent identifier to unsubscribe from.
   * @param resourceType - The type of resource to unsubscribe from.
   * @param options - Optional Ky request options.
   * @returns A promise resolving when the operation completes.
   */
  async unsubscribe(
    pid: string,
    resourceType: string,
    options: KyRequestOptions = {},
  ): Promise<void> {
    await this.request<void>(pid, {
      resourceType,
      method: HTTP_METHODS.DELETE,
      pidRequired: true,
      ...options,
    });
  }

  /**
   * Retrieve subscriptions for a given resource type.
   * @param resourceType - The type of resource to retrieve subscriptions for.
   * @param options - Optional Ky request options.
   * @returns A promise resolving to the subscriptions or undefined.
   */
  getSubscriptions<T = unknown>(
    resourceType: string,
    options: KyRequestOptions = {},
  ): Promise<T | undefined> {
    return this.request<T>(null, {
      resourceType,
      method: HTTP_METHODS.GET,
      pidRequired: false,
      ...options,
    });
  }

  private normalizeResourceTypes(resourceTypes: ReadonlyArray<string>): string[] {
    return Array.from(
      new Set(resourceTypes.map((type) => type.trim()).filter((type) => type.length > 0)),
    );
  }

  private async request<T = unknown>(
    pid: string | null,
    {
      resourceType,
      method = HTTP_METHODS.GET,
      pidRequired = true,
      ...rest
    }: InternalRequestOptions,
  ): Promise<T | undefined> {
    const normalizedResourceType = resourceType.trim();
    if (!this.resourceTypes.has(normalizedResourceType)) {
      throw new TypeError(ERROR_MESSAGES.resourceType);
    }

    const normalizedPid = pid?.trim() ?? "";
    if (pidRequired && normalizedPid.length === 0) {
      throw new TypeError(ERROR_MESSAGES.noPid);
    }

    if (pidRequired && normalizedPid.length > 0) {
      const isValid = await Promise.resolve(this.validatePID(normalizedPid));
      if (!isValid) throw new TypeError(ERROR_MESSAGES.invalidPid);
    }

    const token = await Promise.resolve(this.getToken());
    if (!token) throw new Error(ERROR_MESSAGES.noToken);

    // Construct the endpoint URL by encoding resourceType and optionally PID
    let endpoint = encodeURIComponent(normalizedResourceType);
    if (pidRequired && normalizedPid.length > 0) {
      endpoint = `${endpoint}/${encodeURIComponent(normalizedPid)}`;
    }

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
}

export default NotificationClient;
