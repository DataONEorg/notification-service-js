const DEFAULT_RESOURCE_TYPES = ["datasetChanges", "citations"];
const DEFAULT_DEMO_API_PREFIX = "https://notifications.test.dataone.org/notifications";
const DEFAULT_TOKEN_PLACEHOLDER = "your-access-token";

const configForm = document.getElementById("config-form");
const prefixInput = document.getElementById("prefix-url");
const tokenInput = document.getElementById("access-token");
const resourceTypesInput = document.getElementById("resource-types");
const status = document.getElementById("status");
const logOutput = document.getElementById("log-output");

const subscribeForm = document.getElementById("subscribe-form");
const unsubscribeForm = document.getElementById("unsubscribe-form");
const listForm = document.getElementById("list-form");

const subscribePidInput = document.getElementById("subscribe-pid");
const unsubscribePidInput = document.getElementById("unsubscribe-pid");

const subscribeResourceSelect = document.getElementById("subscribe-resource");
const unsubscribeResourceSelect = document.getElementById("unsubscribe-resource");
const listResourceSelect = document.getElementById("list-resource");
const resourceSelects = [subscribeResourceSelect, unsubscribeResourceSelect, listResourceSelect];

const clearLogButton = document.getElementById("clear-log");

let client = null;

// Update the value & placeholders
prefixInput.value = DEFAULT_DEMO_API_PREFIX;
prefixInput.placeholder = DEFAULT_DEMO_API_PREFIX;
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
  button.disabled = true;
  button.dataset.originalText = button.textContent;
  button.textContent = "Loading...";
};

const hideButtonLoading = (button) => {
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

configForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const prefixUrl = prefixInput.value.trim();
  if (!prefixUrl) {
    status.textContent = "Please provide a valid API prefix URL.";
    return;
  }

  const resourceTypes = formatResourceTypes(resourceTypesInput.value);
  const typesToUse = resourceTypes.length ? resourceTypes : DEFAULT_RESOURCE_TYPES;
  updateResourceTypeOptions(typesToUse);

  try {
    client = new NotificationClient({
      prefixUrl,
      getToken: async () => tokenInput.value.trim(),
      resourceTypes: typesToUse,
      validatePID: async (pid) => pid.trim().length > 0,
    });
    status.textContent = `Client ready. Prefix set to ${prefixUrl.replace(/\/+$/, "")}`;
    log("Client configured", { prefixUrl, resourceTypes: typesToUse });
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
    const response = await client.subscribe(pid, resourceType, {
      hooks: {
        beforeRequest: [
          (request) => {
            const btn = subscribeForm.querySelector("button[type=submit]");
            showButtonLoading(btn);
            console.log("Prepared request:", request);
            return request;
          },
        ],
        afterResponse: [
          async (request, _options, response) => {
            console.log("Raw response:", response);
            const btn = subscribeForm.querySelector("button[type=submit]");
            hideButtonLoading(btn);
            return response;
          },
        ],
      },
    });
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
    await client.unsubscribe(pid, resourceType, {
      hooks: {
        beforeRequest: [
          (request) => {
            const btn = unsubscribeForm.querySelector("button[type=submit]");
            showButtonLoading(btn);
            console.log("Prepared request:", request);
            return request;
          },
        ],
        afterResponse: [
          async (request, _options, response) => {
            console.log("Raw response:", response);
            const btn = unsubscribeForm.querySelector("button[type=submit]");
            hideButtonLoading(btn);
            return response;
          },
        ],
      },
    });
    log("Unsubscribe succeeded", "Subscription removed (no body returned)");
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
    const subscriptions = await client.getSubscriptions(resourceType, {
      hooks: {
        beforeRequest: [
          (request) => {
            const btn = listForm.querySelector("button[type=submit]");
            showButtonLoading(btn);
            console.log("Prepared request:", request);
            return request;
          },
        ],
        afterResponse: [
          async (request, _options, response) => {
            console.log("Raw response:", response);
            const btn = listForm.querySelector("button[type=submit]");
            hideButtonLoading(btn);
            return response;
          },
        ],
      },
    });
    log("Fetched subscriptions", subscriptions ?? "No subscriptions returned");
  } catch (error) {
    console.log(error);
    log("List failed", error, true);
  }
});

clearLogButton.addEventListener("click", () => {
  logOutput.innerHTML = "";
  status.textContent = "Log cleared.";
});
