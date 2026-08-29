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
    saved: (what: string) => `${what} saved.`,
    deactivated: (what: string) => `${what} deactivated.`,
    reactivated: (what: string) => `${what} reactivated.`,
    userCreated: (name: string) => `${name} can now sign in.`,
  },

  admin: {
    title: "Admin",
    products: "Products",
    productCosts: "Product costs",
    finishes: "Finishes",
    categories: "Categories",
    locations: "Locations",
    users: "Users",
    add: "Add",
    edit: "Edit",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    active: "Active",
    inactive: "Inactive",
    name: "Name",
    sortOrder: "Sort order",
    sellingPrice: "Selling price",
    standardCost: "Standard cost",
    category: "Category",
    image: "Image",
    uploadImage: "Choose image",
    compressing: "Preparing image…",
    imageTooLarge: "That image is too large even after compression. Pick a smaller one.",
    code: "Code",
    locationType: "Type",
    factory: "Factory",
    showroom: "Showroom",
    canOriginate: "Can originate stock",
    role: "Role",
    homeLocation: "Home location",
    fullName: "Full name",
    email: "Email",
    tempPassword: "Temporary password",
    roleAdmin: "Administrator",
    roleOps: "Operations Manager",
    roleFinance: "Finance",
    roleStaff: "Staff",
    financeCanOnlyEditCost: "Finance can change only the standard cost.",
    none: "None",
  },

  opening: {
    title: "Opening balances",
    intro:
      "One-time import of the stock on hand at go-live. Upload a CSV, review every row, then commit. A single bad row commits nothing.",
    columns: "Columns: location_code, product_name, finish_name, quantity, unit_selling_price, unit_standard_cost. finish_name and unit_standard_cost are optional.",
    chooseFile: "Choose CSV",
    goLiveDate: "Go-live date",
    preview: "Preview",
    parsing: "Reading the file…",
    checking: "Checking rows…",
    committing: "Committing…",
    noFile: "Choose a CSV file to begin.",
    parseError: "That file could not be read as CSV.",
    missingColumns: (cols: string) => `The CSV is missing these columns: ${cols}.`,
    rowsOk: (n: number) => `${n} rows ready.`,
    rowsWithErrors: (bad: number, total: number) =>
      `${bad} of ${total} rows have problems. Fix the file and preview again.`,
    totals: (units: number, value: string) => `${units} units · ${value} at selling price`,
    commit: (n: number) => `Commit ${n} rows`,
    committed: (n: number) => `${n} opening movements recorded.`,
    alreadyImported:
      "Opening balances have already been imported. Running this again will add more opening movements on top of what is there. Only do this if you know why.",
    confirmForce: "Yes, import again anyway",
    line: "Line",
  },

  capture: {
    addLine: "Add line",
    lines: (n: number) => (n === 1 ? "1 line" : `${n} lines`),
    remove: "Remove",
    variantNote: "Variant note",
    variantNoteEg: "e.g. custom 1200mm width",
    orderNumber: "Order number",
    transactionDate: "Date it happened",
    deliveryDate: "Delivery date",
    reasonNote: "What was returned and why",
    availableAt: (loc: string) => `available at ${loc}`,
    fromLocation: "From",
    toLocation: "To",
    pickAProduct: "Pick a product",
    noLinesYet: "No lines added yet.",

    originateTitle: "Originate stock",
    originateAction: "Record stock",
    cannotOriginateHere: "Stock can't be originated at your location.",

    transferTitle: "Send transfer",
    transferAction: "Send transfer",
    transferSameLocation: "Choose a different destination.",

    receiveTitle: "Confirm receipt",
    receiveOne: "Confirm receipt",
    dispatchedQty: "Sent",
    receivedQty: "Received",
    ageHours: (h: number) => (h < 1 ? "just now" : h === 1 ? "1 hour ago" : `${h} hours ago`),
    varianceWarning:
      "You received fewer than were sent. This will be reported as a variance for the Operations Manager to resolve.",

    deliverTitle: "Deliver to customer",
    deliverAction: "Record delivery",

    returnTitle: "Record a return",
    returnAction: "Record return",

    checkStockTitle: "Check stock",
    checkStockPrompt: "Type a product name.",
    onHandAt: "On hand",
    inTransit: "In transit",
  },

  adjust: {
    title: "Post adjustment",
    openVariances: "Open variances",
    increase: "Increase",
    decrease: "Decrease",
    reason: "Reason",
    noteRequired: "This reason needs a note",
    post: "Post adjustment",
    posted: "Adjustment posted.",
    pickReason: "Choose a reason",
    resolve: "Resolve",
    resolveTitle: (ref: string) => `Resolve ${ref}`,
    resolveSummary: (units: number) =>
      units === 1 ? "1 unit short" : `${units} units short`,
    resolveConfirm: (units: number) =>
      `Post an adjustment for ${units === 1 ? "1 shorted unit" : `${units} shorted units`}?`,
    resolved: (ref: string) => `${ref} resolved.`,
    fromVariance: (ref: string) => `Resolving the shortfall on ${ref}.`,
    noVariances: "No open variances. Everything received matches what was sent.",
  },

  reports: {
    title: "Reports",
    stockOnHand: "Stock on hand",
    stockMovement: "Stock movement",
    inTransit: "In transit",
    closePack: "Monthly close pack",
    openVariances: "Open variances",

    asAt: "As at",
    from: "From",
    to: "To",
    allLocations: "All locations",
    allCategories: "All categories",
    allTypes: "All types",
    allUsers: "Anyone",
    apply: "Apply",
    downloadCsv: "Download CSV",
    monthEnd: "Month-end date",
    getPack: "Download close pack",

    valueAtSelling: "Value at selling price",
    valueAtStandardCost: "Value at standard cost",
    quantity: "Quantity",
    subtotal: "Subtotal",
    grandTotal: "Grand total",
    missingCostFooter: (n: number) =>
      n === 1
        ? "1 line has no standard cost, so its cost value is shown as zero."
        : `${n} lines have no standard cost, so their cost value is shown as zero.`,
    reference: "Reference",
    enteredBy: "Entered by",
    reverses: (id: number) => `reverses #${id}`,
    ageHours: "Age (h)",
    dispatchedBy: "Sender",
    lines: "Lines",
    noRows: "No rows for the selected range.",
    closePackIntro:
      "One CSV of closing stock at a month-end date — quantity and both values by location, product and finish. This is what Finance posts against in ERPNext.",
  },

  counts: {
    title: "Stock counts",
    openTitle: "Open a count",
    openAction: "Open count",
    countDate: "Count date",
    status: "Status",
    accuracy: "Line accuracy",
    netVariance: "Net variance",
    open: "Open",
    submitted: "Submitted",
    posted: "Posted",
    cancelled: "Cancelled",
    none: "No stock counts yet.",
    alreadyOpen: "There is already an open or submitted count for this location.",

    countStock: "Count stock",
    progress: (done: number, total: number) => `${done} of ${total} counted`,
    counted: "Counted",
    addItem: "Add an item not on this list",
    submitCount: "Submit count",
    submitConfirm: "Submit this count? The variance becomes visible to the Operations Manager.",
    submitted_toast: "Count submitted.",

    review: "Review",
    system: "System",
    variance: "Variance",
    valueImpact: "Value impact",
    lineAccuracy: "Line accuracy",
    unitsOver: "Units over",
    unitsShort: "Units short",
    netValueImpact: "Net value impact",
    lateWarning:
      "Some movements at this location were entered after the count was opened but dated on or before the count date. The posted adjustments may be slightly off.",
    postCount: "Post count",
    postConfirm: "Post this count? An adjustment is created for every non-zero variance.",
    posted_toast: "Count posted. Adjustments created for every variance.",
    cancelCount: "Cancel count",
    cancelConfirm: "Cancel this count? Nothing is posted.",
    postedReadOnly: "This count is posted. Adjustments have been created.",
  },
} as const;

export type Strings = typeof en;
