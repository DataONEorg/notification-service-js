## Notification Service JS: A JavaScript client for the DataONE Notification Service

- **Authors**: Thiessen-Bock, Robyn (https://orcid.org/0000-0002-1615-3963)
- **License**: [Apache 2](http://opensource.org/licenses/Apache-2.0)
- [Package source code on GitHub](https://github.com/DataONEorg/notification-service-js)
- [**Submit Bugs and feature requests**](https://github.com/DataONEorg/notification-service-js/issues)
- Contact us: support@dataone.org
- [DataONE discussions](https://github.com/DataONEorg/dataone/discussions)

The DataONE Notification Service JavaScript client provides an interface to the [DataONE Notification Service API]. This interface can be used by web applications to allow users to subscribe, unsubscribe, and manage notifications for datasets and portals. Events users can subscribe to include downloads, views, citations, derived products, new datasets added to a portal, reminders to update a portal, etc.

DataONE in general, and the Notification Service client in particular, are open source, community projects. We [welcome contributions](./CONTRIBUTING.md) in many forms, including code, graphics, documentation, bug reports, testing, etc. Use the [DataONE discussions](https://github.com/DataONEorg/dataone/discussions) to discuss these contributions with us.

## Documentation

## npm (ES modules & modern bundlers)

```sh
# npm install dataone-notifications
npm install git+https://github.com/DataONEorg/notification-service-js.git
```

```ts
import NotificationClient from "dataone-notifications";

const client = new NotificationClient({
  /* ... */
});
```

## RequireJS / AMD (ky bundled)

```sh
git clone https://github.com/DataONEorg/notification-service-js.git
cd notification-service-js
npm install
npm run build
cp dist/dataone-notifications.bundle.umd.js /path/to/your/project/deps/
```

```js
define(["deps/dataone-notifications.bundle.umd"], (DataONENotifications) => {
  const { NotificationClient } = DataONENotifications;
  const client = new NotificationClient({
    /* ... */
  });
});
```

### <script> tag (UMD, ky bundled)

Install

```sh
git clone https://github.com/DataONEorg/notification-service-js.git
cd notification-service-js
npm install
npm run build
cp /path/to/notification-service-js/dist/notification-client.umd.bundle.js /path/to/your/project/deps/
```

```html
<script src="deps/dataone-notifications.bundle.umd.js"></script>
<script>
  const { NotificationClient } = window.DataONENotifications;
  const client = new NotificationClient({
    /* ... */
  });
</script>
```

## Usage

```js
const client = new NotificationClient({
  prefixUrl: "https://example.notifications.dataone.org/notify/v1/",
  getToken: async () => {
    // this function must return a valid JWT token string
    return "token";
  },
});

// The identifier for the resource to subscribe to
const pid = "doi:10.abc/123";

// Subscribe to notifications for a dataset
const subscription = await client.subscribe(pid, "datasetChanges");
console.log("Subscription summary:", subscription);

// List current subscriptions for a resource type
const datasetSubs = await client.getSubscriptions("datasetChanges");
console.log(
  "The user with ID",
  datasetSubs.subject,
  "has",
  datasetSubs.resourceIds.length,
  "dataset subscriptions.",
);

// Unsubscribe from notifications for a dataset
await client.unsubscribe(pid, "datasetChanges");
console.log("Unsubscribed from notifications for", pid);

// Use some of the ky features
const subscription2 = await client.subscribe(pid, "datasetChanges", {
  // 10 second timeout
  timeout: 10 * 1000,
  // hooks
  hooks: {
    beforeRequest: [
      (request) => {
        console.log("Starting request for", request);
      },
    ],
    afterResponse: [
      (request, options, response) => {
        console.log("Received response for", request, response);
        // Modify the response.
        return response;
      },
    ],
  },
});
```

## Development

Install dependencies with `npm install`.

- `npm run demo` starts Vite in `demo/` at http://localhost:4173, hot-loading changes from `src/client.ts`.
- `npm run build:demo` bundles the static demo into `demo/dist/`.
- `npm run build` runs tsup to emit:
  - ESM library (`dist/dataone-notifications.mjs`, ky external)
  - UMD bundle (`dist/dataone-notifications.bundle.umd.js`, ky included)
  - Type definitions (`dist/dataone-notifications.d.ts`)
- `npm test` runs the Vitest suite.
- `npm run lint` and `npm run format:check` ensure code style stays consistent.

## License

```
Copyright [2025] [Regents of the University of California]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Acknowledgements

Work on this package was supported by:

- DataONE Network
- Arctic Data Center: NSF-PLR grant #2042102 to M. B. Jones, A. Budden, M. Schildhauer, and J. Dozier

Additional support was provided for collaboration by the National Center for Ecological Analysis and Synthesis, a Center funded by the University of California, Santa Barbara, and the State of California.

[![DataONE_footer](https://user-images.githubusercontent.com/6643222/162324180-b5cf0f5f-ae7a-4ca6-87c3-9733a2590634.png)](https://dataone.org)

[![nceas_footer](https://www.nceas.ucsb.edu/sites/default/files/2020-03/NCEAS-full%20logo-4C.png)](https://www.nceas.ucsb.edu)
