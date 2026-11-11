# The preview contract and its pin

**Kind:** procedure. How the frame's reader is held to the plugin's schemas, and how to move
the pin.

## Why

The admin (`micelio-plugin-core`) sends the messages of the visual editing protocol from the
schemas of `contract/preview.ts`. The frame does not import them: `readBlockMessage` in
`app/helpers/previewBlocks.ts` reads the same messages by hand, so the preview code carries no
dependency on the plugin (ADR 0019). Nothing but a test can tell that the two agree.

## What the test does

`test/previewContract.test.ts` runs a set of messages for each message towards the frame
(`micelio:select`, `micelio:hover`, `micelio:insertGap`, `micelio:patch`, `micelio:renderMode`),
valid ones and ones with a field missing, renamed or of the wrong type, through the schemas of the
pinned contract and through `readBlockMessage`. A message the contract accepts must be a message
the frame reads; one the contract refuses must be `malformed` or ignored by the frame. A message
that stays outside the set, because the frame is stricter on purpose or the two differ, is listed in
`KNOWN_DIFFERENCES` in the test with the reason.

The contract is a checked-in copy, `test/fixtures/plugin-contract/preview.ts`, at the commit in
`test/fixtures/plugin-contract/PIN`. A copy needs no network and no access to the plugin's
repository, so the test is the same on a laptop, in CI and in the Docker run of
[testing a branch](testing-a-branch.md). It is a test fixture only: the app never imports it.

`micelio:run` is not in that set yet: the pinned contract does not list it (bogd3v/micelio-plugin-core#134 adds it), so `readBlockMessage` reads it by hand and
`test/previewRun.test.ts` checks it. When the pin moves to a commit that lists `micelio:run` and `micelio:runResult`, add them to the set of `test/previewContract.test.ts`.

## Moving the pin

Do this when the plugin's contract changes (a message, a field or a limit).

1. In a checkout of `bogd3v/micelio-plugin-core`, `git fetch origin` and pick the commit `<sha>` of
   `main` that holds the contract to follow.
2. From the root of this repository:

   ```bash
   SHA=<sha>
   git -C ../micelio-plugin-core show "${SHA}:contract/preview.ts" \
     > test/fixtures/plugin-contract/preview.ts
   echo "$SHA" > test/fixtures/plugin-contract/PIN
   npx vitest run test/previewContract.test.ts
   ```

3. A failure names the message where the frame and the contract disagree. Change `readBlockMessage`
   (and the types in `app/interfaces/preview.ts`) so they agree, or, when the frame must stay
   stricter, record the case in `KNOWN_DIFFERENCES` with the reason. Add a case to the test for a
   field or a message the new contract adds.
4. Run `npm run check`. The pull request says which commit the pin moved from and to.
