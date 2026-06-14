# CSS ownership

- `foundation.css`: reset, element defaults, application layout, typography, grids and utilities.
- `components.css`: reusable components shared by more than one view.
- `themes.css`: theme tokens and selectors whose behavior differs by `data-theme`.
- `owners/*.css`: cross-page contracts owned by the shell or shared infrastructure.
- `pages/*/*.css`: styles used exclusively by one page, including its responsive and theme variants.

Page-specific components must not be reintroduced into `foundation.css`, `components.css` or `themes.css`.

## Automated audit

`npm run check:css` fails on unsupported `data-theme` selectors, any `!important`,
and classes without a TS/TSX/JS/JSX reference. Existing unused classes are tracked
in `scripts/css-unused-baseline.json`; update it deliberately with
`npm run check:css:baseline` only after reducing that inventory.
