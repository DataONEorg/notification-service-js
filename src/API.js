/**
 * @file API client for the Notification Service
 * @fileoverview API client for the Notification Service
 * @since 0.0.1
 */

import ky from "ky";

// Default resource types if none provided (can be overridden in constructor)
const DEFAULT_TYPES = Object.freeze(["datasetChanges", "citations"]);

// String constants for error messages
const ERROR_MESSAGES = Object.freeze({
  prefixUrl: "prefixUrl is required",
  getToken: "A getToken function is required",
  validatePID: "validatePID must be a function",
  resourceTypes: "resourceTypes must be a non-empty array of strings",
  resourceType: "Invalid resource type",
  noPid: "PID is required",
  invalidPid: "PID is invalid",
  noToken: "Token is required",
});

// HTTP methods we use
const METHODS = Object.freeze({
  GET: "GET",
  POST: "POST",
  DELETE: "DELETE",
});

/**
 * NotificationService client
 * @since 0.0.1
 */
export class NotificationService {
  /**
   * Create a new NotificationService client
   * @param {Object} options Configuration options
   * @param {string} options.prefixUrl Base URL of the notification service API
   * @param {Function} options.getToken Function that returns a Promise resolving to a bearer token string
   * @param {Function} [options.validatePID] Optional function to validate a PID; should return a Promise resolving to true/false
   * @param {Array<string>} [options.resourceTypes] Array of valid resource types; defaults to ['datasetChanges', 'citations']
   * @param {Object} [options.kyOptions] Optional default options to pass to ky
   * (hooks, timeout, etc.). Ignored if kyInstance is provided.
   * @param {Object} [options.kyInstance] Optional existing ky instance to use
   * instead of creating one (useful for sharing hooks, etc.)
   */
  constructor({
    prefixUrl,
    getToken,
    validatePID = async () => true,
    resourceTypes = DEFAULT_TYPES,
    kyOptions = {},
    kyInstance = null,
  } = {}) {
    // Validate params before assignment
    if (!prefixUrl) throw new TypeError(ERROR_MESSAGES.prefixUrl);
    if (typeof getToken !== "function")
      throw new TypeError(ERROR_MESSAGES.getToken);
    if (typeof validatePID !== "function")
      throw new TypeError(ERROR_MESSAGES.validatePID);
    if (
      !Array.isArray(resourceTypes) ||
      resourceTypes.length === 0 ||
      !resourceTypes.every((t) => typeof t === "string")
    ) {
      throw new TypeError(ERROR_MESSAGES.resourceTypes);
    }

    this.prefixUrl = prefixUrl.replace(/\/+$/, "");
    this.getToken = getToken;
    this.validatePID = validatePID;
    this.resourceTypes = new Set(resourceTypes);

    // One ky instance with shared defaults; callers can still override per request
    this.ky =
      kyInstance || ky.create({ prefixUrl: this.prefixUrl, ...kyOptions });
  }

  /**
   * Check if a resource type is valid. In the future we ca
   * @param {string} resourceType Resource type to check
   * @returns {boolean} True if valid, false if not
   * @private
   */
  _validateResourceType(resourceType) {
    return (
      typeof resourceType === "string" && this.resourceTypes.has(resourceType)
    );
  }

  /**
   * Internal method to make an API request
   * @param {string|null} pid PID to include in the request URL (if required)
   * @param {Object} options Request options
   * @param {string} options.resourceType Resource type (required)
   * @param {string} [options.method='GET'] HTTP method
   * @param {boolean} [options.pidRequired=true] Whether a PID is required for this request
   * @param {Object} [options.headers] Additional headers to include in the request
   * @returns {Promise<any>} Parsed JSON response, or undefined for 204/205/304 responses
   *
   * @private
   * @param {...any} [options.rest] Other ky options (searchParams, json/body, hooks, signal, timeout, etc.)
   */
  async _request(
    pid,
    {
      resourceType,
      method = METHODS.GET,
      pidRequired = true,
      headers,
      ...rest
    } = {}
  ) {
    if (!this._validateResourceType(resourceType)) {
      throw new TypeError(ERROR_MESSAGES.resourceType);
    }

    if (pidRequired && !pid) throw new TypeError(ERROR_MESSAGES.noPid);
    if (pidRequired) {
      const ok = await this.validatePID(pid);
      if (!ok) throw new TypeError(ERROR_MESSAGES.invalidPid);
    }

    // Prepare auth header
    const token = await this.getToken();
    if (!token) throw new Error(ERROR_MESSAGES.noToken);
    const authHeader = { Authorization: `Bearer ${token}` };

    // Merge headers. keep Authorization unless explicitly replaced
    const mergedHeaders = { ...authHeader, ...(headers || {}) };

    let endpoint = encodeURIComponent(resourceType);
    if (pidRequired) endpoint = `${endpoint}/${encodeURIComponent(pid)}`;

    // Allow all ky options via ...rest.
    // Note: ky automatically throws on HTTP errors
    const response = await this.ky(endpoint, {
      method,
      headers: mergedHeaders,
      ...rest,
    });
    const noBodyStatuses = [204, 205, 304]; // spec mandates no body
    if (noBodyStatuses.includes(response.status)) return undefined;
    return await response.json();
  }

  /**
   * Subscribe to notifications for a given PID and resource type
   * @param {string} pid PID to subscribe to
   * @param {string} resourceType Resource type
   * @param {Object} [options] Additional ky options (headers, hooks, signal, timeout, etc.)
   * @returns {Promise<Object>} Subscription details from the API
   */
  subscribe(pid, resourceType, options = {}) {
    return this._request(pid, {
      resourceType,
      method: METHODS.POST,
      pidRequired: true,
      ...options,
    });
  }

  /**
   * Unsubscribe from notifications for a given PID and resource type
   * @param {string} pid PID to unsubscribe from
   * @param {string} resourceType Resource type
   * @param {Object} [options] Additional ky options (headers, hooks, signal, timeout, etc.)
   * @returns {Promise<void>} Resolves when the unsubscription is successful
   */
  unsubscribe(pid, resourceType, options = {}) {
    return this._request(pid, {
      resourceType,
      method: METHODS.DELETE,
      pidRequired: true,
      ...options,
    });
  }

  /**
   * Get all subscriptions for a given resource type
   * @param {string} resourceType Resource type
   * @param {Object} [options] Additional ky options (headers, hooks, signal, timeout, etc.)
   * @returns {Promise<Array>} Array of subscription objects
   */
  getSubscriptions(resourceType, options = {}) {
    return this._request(null, {
      resourceType,
      method: METHODS.GET,
      pidRequired: false,
      ...options,
    });
  }
}

export default NotificationService;
