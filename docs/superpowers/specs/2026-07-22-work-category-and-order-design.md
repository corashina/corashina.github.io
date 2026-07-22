# Work category and order design

## Project classification

Project metadata adds a `category` value of either `commercial` or `experiments`.

Commercial work contains XELapps, ICR, Workflow, Holiday, eInvoicing, Xelcode, Kiteprint, and Fitmed. Experiments contains Particle Simulation, Civio, Flappy-Pixie, Endless-City, and WebGL-Minecraft.

## Ordering

The Work page sorts each category independently by `startedAt`, newest first. Dates with the same year retain the declared commercial order: Workflow, Holiday, eInvoicing. This produces Kiteprint before Fitmed because their known 2018 month values differ.

## Presentation

The Work page replaces its single grid with two labeled grids: `Commercial work` first and `Experiments` second. Cards, media behavior, and project detail pages remain unchanged.

## Testing

Data tests assert each project category. Work-page tests assert the category headings, rendered card order, and that the project count remains complete across both sections.
