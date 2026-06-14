# CSS ownership

- `foundation.css`: reset, element defaults, application layout, typography, grids and utilities.
- `components.css`: reusable components shared by more than one view.
- `themes.css`: theme tokens and selectors whose behavior differs by `data-theme`.
- `owners/*.css`: cross-page contracts owned by the shell or shared infrastructure.
- `pages/*/*.css`: styles used exclusively by one page, including its responsive and theme variants.

Page-specific components must not be reintroduced into `foundation.css`, `components.css` or `themes.css`.
Page components must not borrow another page's prefixed classes. For example, an
`admin-*` component cannot depend on `profile-*` styles.

When a component stops being sticky or fixed, remove its old `top` declarations
instead of overriding them later. The audit rejects classes that combine
`position: relative` with a non-`auto` `top` across CSS layers.

## Automated audit

`npm run check:css` fails on unsupported `data-theme` selectors, any `!important`,
unsafe relative offsets, and classes without a TS/TSX/JS/JSX reference. Existing unused classes are tracked
in `scripts/css-unused-baseline.json`; update it deliberately with
`npm run check:css:baseline` only after reducing that inventory.
