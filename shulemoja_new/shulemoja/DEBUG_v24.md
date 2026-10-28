# Debug report v24

## Build
- `npm run build` succeeds.

## Fixes in this pass
1. **AccountGate** — pending / suspended staff & parent see a clear waiting screen (not a blank app or full dashboard).
2. **Webhook** — removed broken `fee_payments` insert (`amount` vs `amount_paid`, missing `term_id`). School fees stay out of platform STK.
3. Confirmed v23 behaviour: parent fee UI is till/paybill only.

## Already healthy
- Vite production build
- ESM Netlify functions
- Super Admin payments log tab
- Login Subscribe modal
- Premium module gates
- ErrorBoundary
- Student enrollment on add
