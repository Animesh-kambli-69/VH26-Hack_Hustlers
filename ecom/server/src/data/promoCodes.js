// Promo codes for the demo store.
//
// Server-side only source of truth: the client may *suggest* codes, but
// every discount is recomputed and validated here at checkout/quote time.
//
// kind:
//   - 'percent'  → fraction of the subtotal (cap: maxDiscount)
//   - 'flat'     → fixed amount off
//   - 'freeship' → waives the shipping fee entirely
// minSubtotal: order subtotal (before discounts) must be >= this to qualify.
export const promoCodes = [
  {
    code: 'SAVE10',
    kind: 'percent',
    pct: 0.1,
    maxDiscount: 25,
    minSubtotal: 0,
    label: '10% off your order',
    hint: '10% off (up to $25)',
  },
  {
    code: 'FLAT5',
    kind: 'flat',
    amount: 5,
    minSubtotal: 25,
    label: '$5 off orders over $25',
    hint: '$5 off orders over $25',
  },
  {
    code: 'FREESHIP',
    kind: 'freeship',
    minSubtotal: 0,
    label: 'Free shipping on this order',
    hint: 'Free shipping',
  },
];

export function findPromoCode(rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim().toUpperCase();
  return promoCodes.find((p) => p.code === code) || null;
}
