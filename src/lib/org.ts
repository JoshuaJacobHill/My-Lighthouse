/**
 * Organisation details for donation receipts (donor portal — plan §10).
 *
 * NOTE: `isDGR` drives the tax-deductibility wording on receipts. Confirm
 * Lighthouse Care's DGR endorsement before launch and set this accordingly —
 * until then receipts state the gift without asserting deductibility.
 */
export const ORG = {
  name: 'Lighthouse Care',
  abn: '87 637 110 948',
  isDGR: false as boolean,
} as const
