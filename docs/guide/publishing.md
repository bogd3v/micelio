# Publish articles and pages

*Kind: how-to. This page shows how to write an article, publish it, take it down, and write its Spanish version.*

Articles and pages have two versions: the **draft**, which you save while you work, and the **published** version, which visitors see. Saving changes the draft. Publishing makes the saved draft the version visitors see. Site settings and the About page have no draft: saving them changes what visitors see at once.

## 1. Write an article

1. In the Content Manager, open **Articles** and create an entry.
2. Enter the **title** and the **description**. The description is the short summary of the article.
3. Check the **slug**. Strapi suggests it from the title. It is the address of the article, `/blog/<slug>`, so keep it short and lowercase, with hyphens.
4. Choose the **author** from the Authors list, one **category** and any number of **tags**.
5. Add a **cover** image if you want one. Fill in its **cover credit** with the kind of image, its author, its source and its license. The CMS refuses a credit that lacks a field its license requires, or that has a malformed address.
6. Write the body in the **blocks** list. Each block is one of:
   - **Rich text**: Markdown text.
   - **Media**: one image or file, with a caption and a credit.
   - **Quote**: a title and a quoted text.
   - **Slider**: a set of slides.
   - **Playground**: a short code example, with its expected output, a caption and optional setup code. The setup code runs before the example and is not shown to readers.
7. Add **references** if you cite sources. Each reference has a key, a type, its authors, a year and a title. In the body, write the key as `[@key]` where the citation goes. The CMS refuses to save a body with a `[@key]` that has no reference, and it refuses to save a reference that has no key.
8. Fill in the **SEO** block if you want to control the search and social description.
9. Save. Then publish, as described in section 3.

## 2. Save, publish, unpublish and delete

- **Save** keeps your work as a draft. Visitors do not see it. An article may stay a draft as long as you need.
- **Publish** makes the saved draft the visible version.
- **Unpublish** takes the article off the site. The draft remains in the admin panel, so you can publish it again later. The article leaves the blog, and its address answers "not found".
- **Delete** removes the entry.

Saving a draft does not change the site in a static or landing site. Publishing, unpublishing and deleting do (see section 4).

The same rules apply to pages, which are described in [Build a page from sections](pages-and-sections.md).

## 3. Publish

1. Check the entry: title, description, slug, author, category, the body blocks and the references.
2. Publish it with the Publish action of the entry. Strapi refuses the publication if a required field is empty.
3. Open the article's address after a few minutes in a dynamic site, or after the next build in a static or landing site (see section 4). The address is `/blog/<slug>`.

## 4. What happens after publishing, by site mode

The operator of the site chooses the mode when the site is installed. You cannot change it in the admin panel, and the same article behaves differently in each mode. The operator documentation is [Hosting a static or landing site](../operate/static-site.md).

**Dynamic mode** (a server renders the pages):

- The site reads the new content from the CMS when a page is requested, but it keeps the answers for a while. The home page, the blog and the articles show a change after up to about five minutes. The About page keeps its answer for about an hour.
- Changes to the Site settings, such as the home page or the theme overrides, reach the pages after the same delays, up to about six minutes for the blog and the home page.
- Comments, accounts, drafts and the fediverse are available in this mode only.

**Static mode** and **landing mode** (the site is built into files):

- Publishing, unpublishing and deleting an article or a page, and saving the Site settings, can start a new build of the site. The operator must have connected the CMS to the build. If they have not, the build runs by hand, and your change is not visible until it does.
- The new version appears after that build finishes and is published by the host. The build takes the time the operator's pipeline needs.
- **Saving the About page does not start a build** in these modes. Ask the operator to run the build after you change About.
- In a landing site, the blog exists only while there is at least one published article. The navigation of a landing site is built from the home page sections (see [Build a page from sections](pages-and-sections.md)).
- There is no preview in these modes. To see a draft as it will look, you need a dynamic copy of the site, which the operator can set up.

## 5. Translations

Each article has one entry per language. The site has two languages: English (`en`) and Spanish (`es`).

1. Open the article and switch its language to Spanish, using the language selector of the entry. Strapi creates the Spanish version from the English one.
2. Translate the title, the description, the cover credit, the body blocks and the SEO block.
3. Give it its own **slug**. The Spanish address is `/es/blog/<slug>`, and the language switcher goes to the slug of the other language.
4. Publish the Spanish version separately. Publishing the English version does not publish the Spanish one.

Things to know:

- A language with no published version of an article does not show it. The address of that language answers with "not found".
- **References are shared** by every language of the article. Add or change them once; a translation uses the same references and its own `[@key]` citations.
- **Authors** exist in both languages automatically. Their name is shared; their bio is translated.
- The Spanish blog lists only the articles that have a published Spanish version.
- The page translations follow the same rules (see [Build a page from sections](pages-and-sections.md)).

## 6. Before you publish: checklist

- The title, the description and the slug are final.
- The author, the category and the tags are set.
- Every cover credit and every image credit is complete for its license.
- Every `[@key]` in the body has a reference.
- The Spanish version is published if you want the article in Spanish.
- After publishing, the address opens in the right language.
