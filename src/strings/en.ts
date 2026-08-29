/**
 * Every user-facing string in the app (build brief §9 — "single module so Sinhala
 * labels can be added later without touching components").
 *
 * Rules:
 *  - Components never contain literal copy. They call `t.<key>` or a template fn.
 *  - Error copy is written in the app's voice: what happened + what to do.
 *  - A Sinhala file `si.ts` slots in beside this one later with the same shape.
 */
export const en = {
  appName: "Home 47 Inventory",

  auth: {
    signInTitle: "Sign in",
    email: "Email",
    password: "Password",
    signInAction: "Sign in",
    signingIn: "Signing in…",
    signOut: "Sign out",
    invalidCredentials: "That email and password don't match. Try again.",
    noAccount: "Accounts are created by an administrator. Ask yours to add you.",
    sessionExpired: "Your session ended. Sign in again.",
  },

  nav: {
    home: "Home",
    checkStock: "Check stock",
    originate: "Originate stock",
    sendTransfer: "Send transfer",
    confirmReceipt: "Confirm receipt",
    deliver: "Deliver to customer",
    returns: "Record a return",
    counts: "Stock counts",
    adjustments: "Adjustments",
    reports: "Reports",
    admin: "Admin",
  },

  home: {
    greeting: (name: string) => `Hi, ${name}`,
    atLocation: (loc: string) => `You're at ${loc}`,
    noLocation: "No location set on your account. Ask an administrator.",
    inboundBadge: (n: number) =>
      n === 1 ? "1 transfer waiting to be received" : `${n} transfers waiting to be received`,
  },

  common: {
    save: "Save",
    cancel: "Cancel",
    back: "Back",
    quantity: "Quantity",
    finish: "Finish",
    product: "Product",
    location: "Location",
    date: "Date",
    notes: "Notes",
    optional: "optional",
    required: "required",
    loading: "Loading…",
    search: "Search",
  },

  empty: {
    inbound: "Nothing waiting to be received.",
    stockSearch: "Type a product name to see what's in stock.",
    noResults: "No products match that.",
    counts: "No stock counts yet.",
    variances: "No open variances. Everything received matches what was sent.",
    reports: "No rows for the selected range.",
  },

  errors: {
    // Generic fallbacks. Trigger-raised messages (SQLSTATE P0001) are passed through verbatim.
    generic: "Something went wrong. Nothing was saved. Try again.",
    network: "Can't reach the server. Check your connection and try again.",
    forbidden: "You don't have permission to do that.",
    notFound: "That's no longer here. It may have been changed by someone else.",
    validation: "Some fields need fixing. See the notes below each one.",
  },

  confirmations: {
    // The unmissable success state (brief §9). Always names exactly what was recorded.
    recorded: (qty: number, product: string, finish: string | null, location: string) =>
      `Recorded — ${qty} × ${product}${finish ? ` (${finish})` : ""} at ${location}.`,
    transferSent: (ref: string) => `Transfer ${ref} sent. Quote this reference to the driver.`,
    receiptConfirmed: (ref: string) => `Receipt for ${ref} confirmed.`,
    receiptWithVariance: (ref: string) =>
      `Receipt for ${ref} confirmed with a variance. The Operations Manager will resolve it.`,
    adjustmentPosted: "Adjustment posted.",
    countPosted: "Count posted. Adjustments have been created for every variance.",
  },
} as const;

export type Strings = typeof en;
