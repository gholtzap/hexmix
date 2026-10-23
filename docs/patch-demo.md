# Patch review demo

This isolated branch supplies small UI improvements for the Patch video review queue. The old blur and overflow defects have been removed.

Each improvement has a separate stylesheet so the review PRs can merge independently. The empty stylesheets are the baseline; each PR adds one focused rule set. Main is outside this demo.

Fix PRs target `demo/patch-review-20261022`. Before and after recordings use the same viewport, palette, theme, and interaction. Each review identifies its exact head commit. Evidence is stored on a separate branch.
