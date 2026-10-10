# Site editor guide

*Kind: reference (the index of this guide).*

This guide is for the people who write and publish a Micelio site from the Strapi admin panel: articles, pages, and the choice of theme. You do not need to write code or use a terminal.

## Who this is for

- **Editors** who create and publish articles and pages, and who set the look of the site in Site settings.
- **Not for** the people who install, deploy or back up the site (see [Hosting a static or landing site](../operate/static-site.md) and the [operator documentation](../operate/install.md)), nor for those who build a theme (see [How to create a theme](../themes/creating-a-theme.md)).

## What is in this guide

| Page | Kind | What it answers |
| --- | --- | --- |
| [Build a page from sections](pages-and-sections.md) | How-to | How to make a page, such as a home page or a landing page, from sections |
| [Publish articles and pages](publishing.md) | How-to | How to write an article, save and publish it, unpublish it, write its translations, and when visitors see the change |
| [Choose the theme and its overrides](theme.md) | How-to | How to set the default mode, the accent colors and the display font in Site settings |

Each page is one kind only. The kind is written under its title.

## Where things are in the admin panel

Open the admin panel of the CMS and use the **Content Manager**:

| Kind of content | Name in the Content Manager | What you do with it |
| --- | --- | --- |
| Collection type | Articles | Write and publish articles |
| Collection type | Pages | Build pages from sections |
| Collection type | Authors | Add the people who sign articles |
| Collection type | Categories and Tags | Classify articles |
| Single type | About | Write the About page |
| Single type | Site settings | Set the identity of the site, its home page, its modules and its theme |

Article statistics and newsletter subscribers are written by the software, not by editors.

## Words used in this guide

- **Entry**: one article, page, author or other item in the Content Manager.
- **Section**: one block of a page, such as a hero or a list of posts. A page is a list of sections.
- **Block**: one part of an article's body, such as a rich text paragraph, an image or a code playground.
- **Locale**: the language of an entry. The site has two: English (`en`) and Spanish (`es`).
- **Mode**: whether the site is served by a server (`dynamic`), or built into static files (`static` or `landing`). The operator of the site sets the mode; you cannot change it in the admin panel, but it decides how fast your changes appear (see [Publish articles and pages](publishing.md)).
- **Theme**: the look of the site, installed with the site's code. Site settings can only adjust it (see [Choose the theme and its overrides](theme.md)).

## Not covered yet

This first version covers pages, articles, publishing and the theme overrides. The identity fields and the modules of Site settings, the About page, and categories and tags are not described here yet.
