# Micelio Theme Exception

SPDX identifier: `LicenseRef-Micelio-Theme-exception`

> **Draft.** This text must be reviewed by a lawyer before it is merged (#306).

This is an additional permission under section 7 of the GNU Affero General Public License, version 3 (the "AGPL"), granted by the copyright holders of Micelio. It applies to the Micelio frontend, licensed under the AGPL in [LICENSE](LICENSE).

## 1. Definitions

- **"Micelio"** is the program in this repository licensed under the AGPL, together with any modified version of it. Third-party material in the repository (see [THIRD-PARTY.md](THIRD-PARTY.md)) is not part of Micelio for this exception.
- **"The Theme Contract"** is the public interface Micelio offers to themes, in version 1 or any later version published by Micelio's copyright holders, as described in [ADR 0005](docs/adr/0005-theme-contract.md) and in the reference generated from it (`docs/themes/reference/`): the `theme.json` manifest and its schema; the roles, modes and layout variants it declares; the public styling hooks listed in `app/theme/hooks.json`; the closed list of slots with their props; and the **slot APIs**, which are the only parts of Micelio a slot may call or import:
  - the composables `useSite()` and `useAnimations()`;
  - the helpers of `~/helpers/categories` (`CATEGORIES`, `categoryColor`);
  - the types exported from `~/interfaces`;
  - the APIs of Vue, Nuxt (`<NuxtLink>`, `<NuxtImg>`, `useId()`, `useRuntimeConfig()`) and `@nuxtjs/i18n` (`useI18n()`), which are not Micelio's.
- **"A Theme"** is a work made of a `theme.json` manifest and the files it uses (`theme.css`, slot components, fonts, images, messages), that interacts with Micelio only through the Theme Contract, and that contains no part of Micelio other than the names the Theme Contract requires a theme to use (hook classes, slot names and props, role and mode names, the slot APIs, the schema reference). Material taken from a theme that its author licensed separately (for example `themes/starter/`, under MIT-0) is not a part of Micelio.

## 2. Permission

As a special exception, the copyright holders of Micelio give you permission to:

1. create a Theme and distribute it under terms of your choice, including a proprietary license, and
2. combine a Theme with Micelio, build them together into a site, and run or distribute that combination,

without the AGPL applying to the Theme. In that combination Micelio, and any modification of it, stays under the AGPL, with all its obligations (including offering the source of a modified Micelio to its network users, section 13); the rest of the combination stays under its own license.

## 3. What a Theme is not

The permission does not cover, and the AGPL applies to:

- a work that copies or modifies Micelio's own code, styles or components (for example the core layout variants, `app/theme/defaults/` or `themes/bogota/`) beyond the names the Theme Contract requires;
- a work that reaches Micelio outside the Theme Contract, for example by importing composables, components or modules that are not slot APIs, or by selecting classes that are not public hooks;
- changes to Micelio itself, including changes to the Theme Contract.

## 4. Condition: the source link

This permission applies only while the combination keeps visible the link to Micelio's source code that the footer renders in every footer layout variant (see [ADR 0007](docs/adr/0007-license.md), section 2). A Theme may restyle that link but may not hide or remove it. This condition applies whether the Micelio in the combination is modified or not.

## 5. Removing the exception

When you modify Micelio, you may extend this exception to your version, but you are not obliged to. If you do not wish to, delete this exception from your version and from the notices that refer to it.
