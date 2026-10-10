# Choose the theme and its overrides

*Kind: how-to. This page shows how the look of the site is chosen, and how to adjust it from Site settings.*

The **theme** is the look of the site: its colors, its type, its spacing and its layout. It is part of the site's code, so it is installed and chosen when the site is built, by its operator. In the admin panel you cannot switch to another theme.

Site settings can still adjust the installed theme in four ways, called **overrides**. They change a few values and nothing else. You cannot add CSS, new fonts or new colors other than the accent. Empty fields mean "use the theme as it is".

## Where the overrides are

1. In the Content Manager, open **Site settings**.
2. Open the **Theme** block.
3. Fill in the fields you want to change. Leave the others empty.
4. Save. Site settings have no draft, so the saved values apply as soon as they are stored. Visitors see them after a delay that depends on the site's mode; see [Publish articles and pages](publishing.md).

## The four fields

| Field | What it does | Accepted values |
| --- | --- | --- |
| Theme ID | Names the theme you expect the site to use | Lowercase letters, digits and hyphens, starting with a letter |
| Default mode | The mode a visitor sees first, before they choose one | The id of a mode of the installed theme |
| Accent overrides | A different accent color for one mode | One entry per mode: the mode id and a color as `#RRGGBB` |
| Display font | A different font for the headings | One of: `archivo`, `fraunces`, `bricolage-grotesque`, `newsreader`, `space-grotesk` |

### Theme ID

The site has one theme, the one it was built with. A Theme ID that names another theme is ignored, and the site keeps its own theme. Leave this field empty, or enter the name of the theme that the operator installed. Ask the operator which one it is.

### Default mode

A theme has modes, such as a day mode and a night mode. The default mode is the one shown first. Its id must be exactly one of the theme's mode ids. An id the theme does not have is ignored. Ask the operator for the list of mode ids of the installed theme.

### Accent overrides

The accent is the main color of the site: buttons, active links and brand marks. An accent override replaces it in one mode.

- Add one entry per mode. A mode may appear only once in the list; saving is refused when it appears twice, or when the mode or the color is empty.
- A mode the theme does not have is ignored.
- The site checks the contrast of the new accent against the background of its mode. If the color is too faint to read, the site adjusts its lightness until it is readable. If no lightness works, the theme's own accent stays. The adjustment is written to the server log, not to the admin panel, so the color you see on the site may differ from the color you entered.
- An override changes the accent only. The colors of the categories do not change.

### Display font

The display font is used for the headings. Choosing one of the five fonts replaces the theme's display font. The body text and the monospace text do not change. Choosing the font the theme already uses changes nothing.

## Check the result

After saving, open the home page and an article, in each mode of the site. Check that:

- the accent color reads well on the text and the background, in both modes;
- the headings use the font you chose;
- the default mode is the one you expect when you open the site for the first time.

## What you cannot change here

- The theme itself: its layout, its shapes and its colors other than the accent.
- The fonts of the body text and the monospace text.
- Any custom CSS.

To change those, the operator installs another theme, or a developer changes the installed one. See [How to create a theme](../themes/creating-a-theme.md) for theme authors, and [ADR 0005](../adr/0005-theme-contract.md) for the rules of the theme contract.
