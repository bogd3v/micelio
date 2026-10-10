# Build a page from sections

*Kind: how-to. This page shows how to make one page of the site, one goal at a time.*

A page is an entry of the **Pages** collection in the Content Manager. Its body is a list of **sections**, shown in the order you set. The same page can be the home page of the site, a landing page, or a page of its own such as `/pricing`. It needs a title, a slug, and sections. Publishing it is covered in [Publish articles and pages](publishing.md).

## Before you start

- You can edit the Pages collection in the admin panel.
- Decide the slug. It is the address of the page: `/<slug>` in English and `/es/<slug>` in Spanish. Use lowercase letters, digits and hyphens, starting with a letter or digit, up to 64 characters.
- Check the reserved slugs below. A page with one of them can never be opened.

## 1. Create the page

1. In the Content Manager, open **Pages** and create an entry.
2. Enter the **title**. It is the page title, and also the main heading when the first section is not a hero.
3. Enter the **slug**.
4. Fill in the **SEO** block if you want to control the search and social description. Its meta title, meta description and meta image are marked as required in the schema.
5. Save. The page is a draft until you publish it.

Reserved slugs: `about`, `blog`, `privacy`, `confirm`, `account`, `drafts`, `newsletter` and `_theme`, plus `api`, `feed.xml`, `sitemap.xml` and `robots.txt`. A page with one of these slugs is never shown, because the site answers those addresses first.

## 2. Add sections

1. In the **sections** list of the page, choose to add a section. Pick its type from the list below.
2. Fill in its fields. The required ones are marked in the admin panel.
3. Choose its **variant**, which decides the layout of the section. Variants are a fixed list; a theme cannot add new ones.
4. Move the section up or down to set the order.
5. Repeat for each section.

The section types available to editors, with their variants and their required fields:

| Section | Variants | Required fields | What it shows |
| --- | --- | --- | --- |
| Hero | centered, split, full-bleed | title | The opening of the page, with an optional text, two links and a picture |
| Feature grid | grid, list, bento | none; each item needs a title | A set of features, each with an optional icon, text and title |
| Media showcase | left, right, stacked | title is optional; the media is required | One picture or video next to a rich text and an optional link |
| Stats | row, cards | none; each item needs a value and a label | Numbers with their labels |
| Logo cloud | row, marquee | none; each logo needs an image and a name | Logos of clients or partners, optionally linked |
| Testimonials | single, grid | none; each one needs a quote and an author | Quotes from people, with an optional role and picture |
| Pricing | cards, table | none; each plan needs a name and a price | Plans with their features and an optional link |
| FAQ | list, two-columns | none; each question needs an answer | Questions and answers in rich text |
| Call to action | banner, card | title | A closing message with one or two links |
| Post list | cards, list | count | The newest posts, or the posts of one category or one tag |
| Newsletter | inline, card | none | A subscription form; it appears only when the site has the newsletter module on |
| Rich text | none | body | Text in Markdown |
| Gallery | grid, masonry | images | Several pictures |
| Scene | background, inline | model, poster, alt text | A 3D model, with a still picture for visitors who cannot see it |

Notes on some of them:

- **Links** have a label and an address. Hero, Media showcase, Pricing and Call to action have them.
- **Post list** shows the posts of **one** category or **one** tag, or the latest posts when neither is set. Setting both is refused when you save. A page can have at most four post lists that show posts; a fifth one stays empty.
- **Scene** needs a model file; saving is refused for a file that is neither `.glb` nor `.gltf`. Use a `.glb` file: the CMS also accepts `.gltf`, but the site leaves out a scene whose model is not `.glb`, poster included. The poster is also what visitors see while the model loads, or when their browser or their settings do not show the model.
- **Rich text** and the answers of the FAQ are written in Markdown.

## 3. Make the page the home page (optional)

The home page of the site is set in **Site settings**, in the home page field. Each language chooses its own page. Once set:

- `/` shows that page in English, and `/es` shows the page chosen in Spanish.
- The page also stays at its own address, but its canonical address is the home address.

Without a home page, `/` shows the blog. The home page can be changed at any time; see [Publish articles and pages](publishing.md) for when the change reaches visitors.

## 4. Make the page reachable

In a **dynamic** or **static** site, the header lists Home, Blog and About only. A page of your own is not in the header: link to it from another page, from a section link, or from a rich text block.

In a **landing** site (a static site with a landing profile, see [Hosting a static or landing site](../operate/static-site.md)), the navigation lists an anchor for every section of the home page that has a title. Give each section a clear title, because the title is the name of its link. The links of the hero and the call to action sections come after them.

## 5. Translate the page

A page has one entry per language. In the Spanish version of the entry:

- Translate the title, the sections and the SEO block.
- Give it its own **slug**. The address is `/es/<slug>`, and the language switcher of the site goes to the translated slug.

A page in one language only is not shown in the other language, and the other language's address answers with "not found".

## 6. Check before you publish

- Every section has its required fields. Saving a draft can be incomplete; publishing checks the required fields.
- The post list does not name both a category and a tag.
- The scene's model is a `.glb` file.
- The slug is not in the reserved list.
- The home page field points to the right page in each language, if you use one.

When these are true, publish the page as described in [Publish articles and pages](publishing.md).
