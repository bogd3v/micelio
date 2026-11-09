# The Strapi surface of Micelio

**Kind:** reference. The parts of Strapi that `micelio-cms`, `micelio-plugin-core` and the fediverse plugin use, read from their source at one commit each, with the command that produced every list. [ADR-0020](../adr/0020-strapi-contingency.md) uses it to price leaving Strapi; run the commands again to take a new reading.

## How to take a reading

Clone the three repositories side by side and run each command from the folder that holds them:

```sh
git clone https://github.com/bogd3v/micelio-cms.git
git clone https://github.com/bogd3v/micelio-plugin-core.git
git clone https://github.com/bogd3v/micelio-plugin-fediverse.git
```

The commands need `bash`, `git`, GNU `grep` (with `-P`), `tar`, `perl`, `awk` and `node`. Each reads the files of a fixed commit through `git archive`, so the clone's checked-out branch does not matter; `LC_ALL=C` fixes the sort order. For a new reading, replace the commit with the new `HEAD` (`git -C <repository> rev-parse origin/main`), run the commands and write the outputs and the date in [Readings](#readings).

What each list holds:

- **Dependencies:** the packages of `package.json` whose name contains `strapi`, except Micelio's own (`@micelio/…`).
- **Imported entry points:** every `@strapi/…` module the code imports or requires.
- **Names imported:** the named imports from each entry point, types included. A default or namespace import shows only in the list above.
- **Server API:** the members of the `strapi` object the server code reads, to two levels (`strapi.db.query`). `(itself)` means the member is also used other than through a named property: called (`strapi.documents(uid)`), passed or read with optional chaining.
- **Strapi identifiers:** the `admin::`, `strapi::` and `plugin::` names of Strapi and of third-party Strapi plugins (content types, permission actions, middlewares, hooks, stores), split at the first dot. Micelio's own `plugin::micelio.` and `plugin::fediverse.` are left out.
- **Admin API:** the members of the admin application (`app`) and of a plugin's admin APIs (`apis`) that the admin code calls.
- **Schemas and extensions:** the content types and components written in Strapi's schema format, and the files under `extensions/` that change a plugin through Strapi's extension mechanism.

Comment lines are dropped before the server, identifier and admin lists are read, so a name that a comment mentions does not count; a name inside a string or a template does.

## micelio-cms

The distribution, at `1ca078baa0106bca7af0e090caff7ea2b302a26d`, without its local fediverse plugin (`src/plugins/fediverse`, [below](#the-fediverse-plugin)) and without its tests.

### Dependencies

```sh
git -C micelio-cms show 1ca078baa0106bca7af0e090caff7ea2b302a26d:package.json \
  | node -e 'const p = JSON.parse(require("fs").readFileSync(0, "utf8")); for (const f of ["dependencies", "peerDependencies", "devDependencies"]) for (const [n, v] of Object.entries(p[f] ?? {})) if (/strapi/.test(n) && !n.startsWith("@micelio/")) console.log(f, n, v)'
```

```text
dependencies @notum-cz/strapi-plugin-seo ^2.0.12
dependencies @strapi/i18n ^5.59.0
dependencies @strapi/plugin-users-permissions ^5.59.0
dependencies @strapi/provider-email-nodemailer ^5.59.0
dependencies @strapi/provider-upload-aws-s3 ^5.59.0
dependencies @strapi/strapi ^5.59.0
dependencies strapi-plugin-comments ^3.2.4
```

### Imported entry points

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- config src scripts server.js ':(exclude)src/plugins/fediverse' | tar -xO \
  | grep -oE "(from |require\(|import\()'@strapi/[^']+'" | grep -oE "@strapi/[^']+" \
  | LC_ALL=C sort -u
```

```text
@strapi/design-system
@strapi/icons
@strapi/strapi
@strapi/strapi/admin
@strapi/utils
```

### Names imported

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- config src scripts server.js ':(exclude)src/plugins/fediverse' | tar -xO \
  | perl -0777 -ne 'while (/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["\x27](\@strapi\/[^"\x27]+)|const\s*\{([^}]*)\}\s*=\s*require\(["\x27](\@strapi\/[^"\x27]+)/g) { my ($n, $p) = defined $1 ? ($1, $2) : ($3, $4); for (split /,/, $n) { s/^\s*type\s+//; s/\s+as\s+\w+\s*$|\s*:\s*\w+\s*$//; s/^\s+|\s+$//g; print "$p $_\n" if length } }' \
  | LC_ALL=C sort -u | awk '{a[$1] = a[$1] " " $2} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
@strapi/design-system: Alert Box Button Field Flex Link SingleSelect SingleSelectOption TextInput Typography
@strapi/icons: ChartPie ExternalLink
@strapi/strapi/admin: StrapiApp Widget useFetchClient useForm
@strapi/strapi: Core UID compileStrapi createStrapi factories
@strapi/utils: errors
```

### Server API

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- config src scripts server.js ':(exclude)src/plugins/fediverse' ':(exclude)src/admin' ':(exclude)*.json' ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])strapi\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk -F. '{k = $1 "." $2; m = NF > 2 ? $3 : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
strapi.admin: (itself)
strapi.components: (itself)
strapi.config: environment get set
strapi.contentType: (itself)
strapi.createStrapi: (itself)
strapi.cron: add
strapi.customFields: register
strapi.db: (itself) connection dialect getSchemaConnection getSchemaName lifecycles metadata query transaction
strapi.documents: (itself) use
strapi.eventHub: on
strapi.log: error http info warn
strapi.plugin: (itself)
strapi.query: (itself)
strapi.requestContext: get
strapi.server: app routes
strapi.service: (itself)
strapi.store: (itself) get set
```

### Strapi identifiers

`plugin::comments` is `strapi-plugin-comments`, a third-party plugin the distribution installs and extends.

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- config src scripts server.js ':(exclude)src/plugins/fediverse' ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oE "\b(admin|strapi|plugin)::[A-Za-z0-9_.-]*[A-Za-z0-9_-]" \
  | grep -vE '^plugin::(micelio|fediverse)\.' | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
admin::api-token: (itself)
admin::encryption: (itself)
admin::is-creator: (itself)
admin::isAuthenticatedAdmin: (itself)
admin::permission: (itself)
admin::role: (itself)
plugin::comments: client.findAllFlat client.findAllInHierarchy client.post comment comment-report
plugin::content-manager: explorer explorer.create explorer.update
plugin::i18n: locale
plugin::upload: (itself) content-api.find content-api.findOne file
plugin::users-permissions: jwtManagement permission rateLimit role user user.destroyMe user.me users-permissions
strapi::body: (itself)
strapi::cors: (itself)
strapi::errors: (itself)
strapi::favicon: (itself)
strapi::poweredBy: (itself)
strapi::public: (itself)
strapi::query: (itself)
strapi::security: (itself)
strapi::session: (itself)
```

### Admin API

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/admin ':(exclude)*.json' ':(exclude)*.example.*' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])(app|apis)\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
app: customFields.register widgets.register
```

### Schemas and extensions

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src ':(exclude)src/plugins/fediverse' | tar -t \
  | sed -nE 's#.*/content-types/[^/]+/schema\.json$#content-type schema#p; s#^(.*/)?components/[^/]+/[^/]+\.json$#component schema#p; s#^(.*/)?extensions/([^/]+)/.+#extension of the plugin \2#p' \
  | LC_ALL=C sort | uniq -c
```

```text
     51 component schema
      7 content-type schema
      1 extension of the plugin comments
      1 extension of the plugin micelio
      6 extension of the plugin users-permissions
```

## micelio-plugin-core

`@micelio/strapi-plugin-core`, at `d5c899a986f82c27837311ab72394e6a9b737b44`, without its tests and without `docker/cms/`, the Strapi project it runs in for development.

### Dependencies

```sh
git -C micelio-plugin-core show d5c899a986f82c27837311ab72394e6a9b737b44:package.json \
  | node -e 'const p = JSON.parse(require("fs").readFileSync(0, "utf8")); for (const f of ["dependencies", "peerDependencies", "devDependencies"]) for (const [n, v] of Object.entries(p[f] ?? {})) if (/strapi/.test(n) && !n.startsWith("@micelio/")) console.log(f, n, v)'
```

```text
peerDependencies @strapi/design-system ^2.2.4
peerDependencies @strapi/icons ^2.2.4
peerDependencies @strapi/strapi ^5.59.0
peerDependencies @strapi/utils ^5.59.0
devDependencies @strapi/design-system ^2.2.4
devDependencies @strapi/icons ^2.2.4
devDependencies @strapi/plugin-users-permissions ^5.59.0
devDependencies @strapi/sdk-plugin ^6.1.1
devDependencies @strapi/strapi ^5.59.0
devDependencies @strapi/typescript-utils ^5.59.0
devDependencies @strapi/utils ^5.59.0
```

### Imported entry points

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- server/src admin/src contract bin strapi-server.js strapi-admin.js | tar -xO \
  | grep -oE "(from |require\(|import\()'@strapi/[^']+'" | grep -oE "@strapi/[^']+" \
  | LC_ALL=C sort -u
```

```text
@strapi/design-system
@strapi/strapi
@strapi/strapi/admin
@strapi/utils
```

### Names imported

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- server/src admin/src contract bin strapi-server.js strapi-admin.js | tar -xO \
  | perl -0777 -ne 'while (/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["\x27](\@strapi\/[^"\x27]+)|const\s*\{([^}]*)\}\s*=\s*require\(["\x27](\@strapi\/[^"\x27]+)/g) { my ($n, $p) = defined $1 ? ($1, $2) : ($3, $4); for (split /,/, $n) { s/^\s*type\s+//; s/\s+as\s+\w+\s*$|\s*:\s*\w+\s*$//; s/^\s+|\s+$//g; print "$p $_\n" if length } }' \
  | LC_ALL=C sort -u | awk '{a[$1] = a[$1] " " $2} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
@strapi/design-system: Badge Box Breadcrumbs Button Checkbox Crumb Field Flex Link Modal Radio Table Tbody Td Textarea Th Thead Tr Typography VisuallyHidden useNotifyAT
@strapi/strapi/admin: Layouts Page StrapiApp SubNav unstable_useContentManagerContext useAuth useFetchClient useForm useNotification useStrapiApp
@strapi/strapi: Core Modules Schema UID compileStrapi createStrapi factories
@strapi/utils: errors
```

### Server API

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- server/src contract bin strapi-server.js ':(exclude)*.json' ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])strapi\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk -F. '{k = $1 "." $2; m = NF > 2 ? $3 : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
strapi.components: (itself)
strapi.config: get set
strapi.contentAPI: sanitize
strapi.contentType: (itself)
strapi.contentTypes: (itself)
strapi.cron: add
strapi.db: (itself) config connection getSchemaConnection metadata query transaction
strapi.dirs: app static
strapi.documents: (itself) use
strapi.get: (itself)
strapi.hook: (itself)
strapi.log: (itself) error info warn
strapi.plugin: (itself)
strapi.requestContext: get
strapi.server: use
strapi.service: (itself)
strapi.store: get set
```

### Strapi identifiers

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- server/src admin/src contract bin strapi-server.js strapi-admin.js ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oE "\b(admin|strapi|plugin)::[A-Za-z0-9_.-]*[A-Za-z0-9_-]" \
  | grep -vE '^plugin::(micelio)\.' | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
admin::api-token-permission: (itself)
admin::isAuthenticatedAdmin: (itself)
admin::permission: (itself)
admin::role: (itself)
admin::user: (itself)
plugin::content-manager: explorer.create explorer.publish explorer.read explorer.update
plugin::email: provider
plugin::upload: file folder provider security
plugin::users-permissions: permission
strapi::content-types: beforeSync
strapi::core-store: (itself)
strapi::cors: (itself)
strapi::errors: (itself)
strapi::security: (itself)
```

### Admin API

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- admin/src strapi-admin.js ':(exclude)*.json' ':(exclude)*.example.*' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])(app|apis)\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
apis: addDocumentHeaderAction addEditViewSidePanel
app: addMenuLink getPlugin registerPlugin
```

### Schemas and extensions

```sh
git -C micelio-plugin-core archive d5c899a986f82c27837311ab72394e6a9b737b44 -- server/src | tar -t \
  | sed -nE 's#.*/content-types/[^/]+/schema\.json$#content-type schema#p; s#^(.*/)?components/[^/]+/[^/]+\.json$#component schema#p; s#^(.*/)?extensions/([^/]+)/.+#extension of the plugin \2#p' \
  | LC_ALL=C sort | uniq -c
```

```text
      8 component schema
      8 content-type schema
```

## The fediverse plugin

The code of the fediverse plugin still lives in `micelio-cms`, as the local plugin `src/plugins/fediverse`, at the same commit as the distribution above. Its package, `@micelio/strapi-plugin-fediverse`, is at `3064a73590fba69aac9d5b60ffeefacf3a19a45d` and holds the repository template only: it declares no Strapi dependency and imports nothing from Strapi.

```sh
git -C micelio-plugin-fediverse show 3064a73590fba69aac9d5b60ffeefacf3a19a45d:package.json \
  | node -e 'const p = JSON.parse(require("fs").readFileSync(0, "utf8")); for (const f of ["dependencies", "peerDependencies", "devDependencies"]) for (const [n, v] of Object.entries(p[f] ?? {})) if (/strapi/.test(n) && !n.startsWith("@micelio/")) console.log(f, n, v)'
```

```text
(no output)
```

```sh
git -C micelio-plugin-fediverse archive 3064a73590fba69aac9d5b60ffeefacf3a19a45d -- . | tar -xO \
  | grep -cE "(from |require\(|import\()'@strapi/"
```

```text
0
```

The local plugin's own `package.json` declares no dependency, so its lists start with the imports.

### Imported entry points

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse | tar -xO \
  | grep -oE "(from |require\(|import\()'@strapi/[^']+'" | grep -oE "@strapi/[^']+" \
  | LC_ALL=C sort -u
```

```text
@strapi/content-manager/strapi-admin
@strapi/design-system
@strapi/icons
@strapi/strapi
@strapi/strapi/admin
```

### Names imported

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse | tar -xO \
  | perl -0777 -ne 'while (/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["\x27](\@strapi\/[^"\x27]+)|const\s*\{([^}]*)\}\s*=\s*require\(["\x27](\@strapi\/[^"\x27]+)/g) { my ($n, $p) = defined $1 ? ($1, $2) : ($3, $4); for (split /,/, $n) { s/^\s*type\s+//; s/\s+as\s+\w+\s*$|\s*:\s*\w+\s*$//; s/^\s+|\s+$//g; print "$p $_\n" if length } }' \
  | LC_ALL=C sort -u | awk '{a[$1] = a[$1] " " $2} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
@strapi/content-manager/strapi-admin: ContentManagerPlugin PanelComponent
@strapi/design-system: Badge Box Button Flex Table Tbody Td Th Thead Tr Typography
@strapi/icons: Earth
@strapi/strapi/admin: Layouts StrapiApp useFetchClient useNotification useRBAC
@strapi/strapi: Core
```

### Server API

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse/server ':(exclude)*.json' ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])strapi\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk -F. '{k = $1 "." $2; m = NF > 2 ? $3 : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
strapi.config: get
strapi.db: (itself) connection lifecycles metadata query
strapi.documents: (itself)
strapi.eventHub: on
strapi.log: (itself) debug error info warn
strapi.plugin: (itself)
strapi.server: use
strapi.service: (itself)
strapi.store: (itself)
```

### Strapi identifiers

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse ':(exclude)*.md' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oE "\b(admin|strapi|plugin)::[A-Za-z0-9_.-]*[A-Za-z0-9_-]" \
  | grep -vE '^plugin::(fediverse|micelio)\.' | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
admin::isAuthenticatedAdmin: (itself)
admin::permission: (itself)
admin::user: (itself)
plugin::comments: comment comments-moderate
```

### Admin API

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse/admin ':(exclude)*.json' ':(exclude)*.example.*' | tar -xO \
  | grep -vE '^\s*(\*|//|/\*)' | grep -oP '(?<![.\w$])(app|apis)\.\w+(\.\w+)?' \
  | LC_ALL=C sort -u | awk '{i = index($0, "."); k = i ? substr($0, 1, i - 1) : $0; m = i ? substr($0, i + 1) : "(itself)"; a[k] = a[k] " " m} END {for (k in a) print k ":" a[k]}' | LC_ALL=C sort
```

```text
app: addMenuLink getPlugin
```

### Schemas and extensions

```sh
git -C micelio-cms archive 1ca078baa0106bca7af0e090caff7ea2b302a26d -- src/plugins/fediverse | tar -t \
  | sed -nE 's#.*/content-types/[^/]+/schema\.json$#content-type schema#p; s#^(.*/)?components/[^/]+/[^/]+\.json$#component schema#p; s#^(.*/)?extensions/([^/]+)/.+#extension of the plugin \2#p' \
  | LC_ALL=C sort | uniq -c
```

```text
      3 content-type schema
```

## What the lists leave out

- **The frontend.** `micelio` speaks to Strapi only over HTTP, through `strapiFetch` in `server/utils/strapi.ts`, and depends on the content API's shapes (`documentId`, `populate`), which are a contract of the standard's section 6 ([`docs/api.md`](../api.md)). It imports nothing from Strapi.
- **Conventions read from the file layout.** Strapi loads `config/*.ts`, `src/index.ts` (`register`, `bootstrap`), `src/api/<name>/{controllers,routes,services}`, `src/middlewares`, `src/policies` and a plugin's `strapi-server.js` and `strapi-admin.js` by their place, not by an import. Only schemas and extensions are counted above.
- **Calls through a variable or a service.** A Strapi API reached through a variable (`const db = strapi.db; db.query(…)`) or another plugin's service counts only for the part read from `strapi`.
- **Tests and the development project.** The test suites start Strapi through its own harness (`createStrapi`), and `micelio-plugin-core` carries a Strapi project for development in `docker/cms/`; neither ships.
- **Behaviour.** The lists name what the code calls, not what it relies on Strapi to do: the order of lifecycles and plugin `bootstrap`s (ADR-0017, amendment of 2026-10-23), the draft and publish storage, the permission model.

## Readings

| Date | `micelio-cms` | `micelio-plugin-core` | `micelio-plugin-fediverse` | Issue |
| --- | --- | --- | --- | --- |
| 2026-11-09 | `1ca078b` | `d5c899a` | `3064a73` | #843 |
