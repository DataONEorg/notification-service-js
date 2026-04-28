import { NotificationClient } from "@src/client.ts";

const DEFAULT_RESOURCE_TYPES = ["datasetChanges", "citations"];
const DEFAULT_DEMO_API_PREFIX = "https://notifications.test.dataone.org/notifications";
const DEFAULT_API_VERSION = "v1";
const DEFAULT_TOKEN_PLACEHOLDER = "your-access-token";

const configForm = document.getElementById("config-form");
const prefixInput = document.getElementById("prefix-url");
const apiVersionInput = document.getElementById("api-version");
const tokenInput = document.getElementById("access-token");
const resourceTypesInput = document.getElementById("resource-types");
const status = document.getElementById("status");
const logOutput = document.getElementById("log-output");

const subscribeForm = document.getElementById("subscribe-form");
const unsubscribeForm = document.getElementById("unsubscribe-form");
const listForm = document.getElementById("list-form");
const lookupForm = document.getElementById("lookup-form");
const pingForm = document.getElementById("ping-form");

const subscribePidInput = document.getElementById("subscribe-pid");
const unsubscribePidInput = document.getElementById("unsubscribe-pid");
const lookupPidInput = document.getElementById("lookup-pid");

const subscribeResourceSelect = document.getElementById("subscribe-resource");
const unsubscribeResourceSelect = document.getElementById("unsubscribe-resource");
const listResourceSelect = document.getElementById("list-resource");
const resourceSelects = [subscribeResourceSelect, unsubscribeResourceSelect, listResourceSelect];

const clearLogButton = document.getElementById("clear-log");

let client = null;

// Update the value & placeholders
prefixInput.value = DEFAULT_DEMO_API_PREFIX;
prefixInput.placeholder = DEFAULT_DEMO_API_PREFIX;
apiVersionInput.value = DEFAULT_API_VERSION;
apiVersionInput.placeholder = DEFAULT_API_VERSION;
tokenInput.placeholder = DEFAULT_TOKEN_PLACEHOLDER;
resourceTypesInput.placeholder = DEFAULT_RESOURCE_TYPES.join(", ");

const formatResourceTypes = (rawValue) =>
  Array.from(
    new Set(
      (rawValue || "")
        .split(",")
        .map((type) => type.trim())
        .filter(Boolean),
    ),
  );

const updateResourceTypeOptions = (types) => {
  resourceSelects.forEach((select) => {
    select.innerHTML = "";
    types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
  });
};

updateResourceTypeOptions(DEFAULT_RESOURCE_TYPES);

const showButtonLoading = (button) => {
  if (!button) return;
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = "Loading...";
};

const hideButtonLoading = (button) => {
  if (!button) return;
  button.disabled = false;
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
};

const timestamp = () =>
  new Date().toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const log = (label, payload, isError = false) => {
  const wrapper = document.createElement("article");
  wrapper.className = "log-entry";

  const title = document.createElement("h3");
  title.textContent = `${timestamp()} · ${label}`;
  wrapper.appendChild(title);

  const pre = document.createElement("pre");
  if (payload === undefined) {
    pre.textContent = "No response body";
  } else if (payload instanceof Error) {
    pre.textContent = `${payload.name}: ${payload.message}`;
    if (payload.response) {
      pre.textContent += `\nStatus: ${payload.response.status}`;
    }
  } else if (typeof payload === "string") {
    pre.textContent = payload;
  } else {
    try {
      pre.textContent = JSON.stringify(payload, null, 2);
    } catch {
      pre.textContent = String(payload);
    }
  }

  if (isError) {
    const red = "rgba(239, 68, 68, ";
    wrapper.style.background = `${red}0.12)`;
    wrapper.style.borderColor = `${red}0.35)`;
  }

  wrapper.appendChild(pre);
  logOutput.prepend(wrapper);
};

const requestHooks = (form) => ({
  hooks: {
    beforeRequest: [
      (request) => {
        console.log("Prepared request:", request);
        return request;
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        console.log("Raw response:", response);
        return response;
      },
    ],
  },
});

const runFormRequest = async (form, request) => {
  const btn = form.querySelector("button[type=submit]");
  showButtonLoading(btn);
  try {
    return await request(requestHooks(form));
  } finally {
    hideButtonLoading(btn);
  }
};

configForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const prefixUrl = prefixInput.value.trim();
  if (!prefixUrl) {
    status.textContent = "Please provide a valid API prefix URL.";
    return;
  }

  const resourceTypes = formatResourceTypes(resourceTypesInput.value);
  const typesToUse = resourceTypes.length ? resourceTypes : DEFAULT_RESOURCE_TYPES;
  const apiVersion = apiVersionInput.value.trim();
  updateResourceTypeOptions(typesToUse);

  try {
    client = new NotificationClient({
      prefixUrl,
      apiVersion: apiVersion || false,
      getToken: async () => tokenInput.value.trim(),
      resourceTypes: typesToUse,
      validatePID: async (pid) => pid.trim().length > 0,
    });
    status.textContent = `Client ready. Prefix set to ${prefixUrl.replace(/\/+$/, "")}`;
    log("Client configured", {
      prefixUrl,
      apiVersion: apiVersion || false,
      resourceTypes: typesToUse,
    });
  } catch (error) {
    client = null;
    console.log(error);
    status.textContent = error.message;
    log("Client configuration failed", error, true);
  }
});

const ensureClient = () => {
  if (!client) {
    status.textContent = "Instantiate the client first using the configuration form.";
    return false;
  }
  return true;
};

subscribeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureClient()) return;

  const pid = subscribePidInput.value.trim();
  const resourceType = subscribeResourceSelect.value;

  try {
    const response = await runFormRequest(subscribeForm, (options) =>
      client.subscribe({ pid, resourceType }, options),
    );
    log("Subscribe succeeded", response ?? "Subscription request accepted");
  } catch (error) {
    console.log(error);
    log("Subscribe failed", error, true);
  }
});

unsubscribeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureClient()) return;

  const pid = unsubscribePidInput.value.trim();
  const resourceType = unsubscribeResourceSelect.value;

  try {
    const response = await runFormRequest(unsubscribeForm, (options) =>
      client.unsubscribe({ pid, resourceType }, options),
    );
    log("Unsubscribe succeeded", response ?? "Subscription removed");
  } catch (error) {
    console.log(error);
    log("Unsubscribe failed", error, true);
  }
});

listForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureClient()) return;

  const resourceType = listResourceSelect.value;
  try {
    const subscriptions = await runFormRequest(listForm, (options) =>
      client.getSubscriptionsByType({ resourceType }, options),
    );
    log("Fetched subscriptions", subscriptions ?? "No subscriptions returned");
  } catch (error) {
    console.log(error);
    log("List failed", error, true);
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureClient()) return;

  const pid = lookupPidInput.value.trim();

  try {
    const resourceTypes = await runFormRequest(lookupForm, (options) =>
      client.getResourceTypesByPid({ pid }, options),
    );
    log("Fetched resource types", resourceTypes ?? "No resource types returned");
  } catch (error) {
    console.log(error);
    log("Resource type lookup failed", error, true);
  }
});

pingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!ensureClient()) return;

  try {
    const response = await runFormRequest(pingForm, (options) => client.ping(options));
    log("Ping succeeded", response);
  } catch (error) {
    console.log(error);
    log("Ping failed", error, true);
  }
});

clearLogButton.addEventListener("click", () => {
  logOutput.innerHTML = "";
  status.textContent = "Log cleared.";
});
