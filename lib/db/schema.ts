import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
  wrappedDek: string;
  dekIv: string;
  dekTag: string;
  keyVersion: number;
  /** Present when the ciphertext is bound to a stable record context (AAD). */
  aadVersion?: number;
};

export type AuditMetadata = Record<string, unknown>;

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("customer"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    totpSecretEncrypted: jsonb("totp_secret_encrypted").$type<EncryptedSecret>(),
    passwordChangeRequired: boolean("password_change_required").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    pendingTwoFactor: boolean("pending_two_factor").notNull().default(false),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const regions = pgTable(
  "regions",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    accent: text("accent").notNull().default("teal"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("regions_slug_unique").on(table.slug)],
);

export const destinations = pgTable(
  "destinations",
  {
    id: text("id").primaryKey(),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    countryCode: text("country_code").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    popular: boolean("popular").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("destinations_slug_unique").on(table.slug),
    index("destinations_region_id_idx").on(table.regionId),
  ],
);

export const plans = pgTable(
  "plans",
  {
    id: text("id").primaryKey(),
    destinationId: text("destination_id")
      .notNull()
      .references(() => destinations.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    supplierKey: text("supplier_key").notNull(),
    supplierProductId: text("supplier_product_id").notNull(),
    dataMb: integer("data_mb").notNull(),
    validityDays: integer("validity_days").notNull(),
    costMinor: bigint("cost_minor", { mode: "number" }).notNull(),
    markupBps: integer("markup_bps").notNull(),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    taxBps: integer("tax_bps").notNull().default(0),
    coverageSummary: text("coverage_summary").notNull(),
    networkSummary: text("network_summary").notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull(),
    status: text("status").notNull().default("published"),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plans_slug_unique").on(table.slug),
    index("plans_destination_id_idx").on(table.destinationId),
    index("plans_status_idx").on(table.status),
  ],
);

export const carts = pgTable(
  "carts",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("carts_token_unique").on(table.token)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: text("id").primaryKey(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cart_items_cart_plan_unique").on(table.cartId, table.planId),
    index("cart_items_cart_id_idx").on(table.cartId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    email: text("email").notNull(),
    customerName: text("customer_name").notNull(),
    country: text("country").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending_payment"),
    paymentStatus: text("payment_status").notNull().default("pending"),
    fulfillmentStatus: text("fulfillment_status").notNull().default("not_started"),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    termsVersion: text("terms_version").notNull(),
    isDemo: boolean("is_demo").notNull().default(true),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_unique").on(table.orderNumber),
    uniqueIndex("orders_idempotency_key_unique").on(table.idempotencyKey),
    index("orders_email_idx").on(table.email),
    index("orders_created_at_idx").on(table.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    planName: text("plan_name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    costMinor: bigint("cost_minor", { mode: "number" }).notNull(),
    supplierKey: text("supplier_key").notNull(),
    supplierProductId: text("supplier_product_id").notNull(),
    dataMb: integer("data_mb").notNull(),
    validityDays: integer("validity_days").notNull(),
    currency: text("currency").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_items_order_id_idx").on(table.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerPaymentId: text("provider_payment_id").notNull(),
    status: text("status").notNull().default("pending"),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    checkoutUrl: text("checkout_url").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_provider_payment_unique").on(table.provider, table.providerPaymentId),
    index("payments_order_id_idx").on(table.orderId),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("webhook_events_provider_external_unique").on(
      table.provider,
      table.externalEventId,
    ),
  ],
);

export const fulfillmentJobs = pgTable(
  "fulfillment_jobs",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("fulfillment_jobs_order_item_unique").on(table.orderItemId),
    uniqueIndex("fulfillment_jobs_idempotency_unique").on(table.idempotencyKey),
    index("fulfillment_jobs_status_next_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const esims = pgTable(
  "esims",
  {
    id: text("id").primaryKey(),
    orderItemId: text("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    supplierKey: text("supplier_key").notNull(),
    supplierEsimId: text("supplier_esim_id").notNull(),
    iccid: text("iccid"),
    lpaCiphertext: text("lpa_ciphertext").notNull(),
    lpaIv: text("lpa_iv").notNull(),
    lpaTag: text("lpa_tag").notNull(),
    dekWrapped: text("dek_wrapped").notNull(),
    dekIv: text("dek_iv").notNull(),
    dekTag: text("dek_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    status: text("status").notNull().default("ready_to_install"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("esims_order_item_unique").on(table.orderItemId),
    uniqueIndex("esims_iccid_unique").on(table.iccid),
  ],
);

export const supplierTransactions = pgTable(
  "supplier_transactions",
  {
    id: text("id").primaryKey(),
    supplierKey: text("supplier_key").notNull(),
    clientTransactionId: text("client_transaction_id").notNull(),
    supplierOrderId: text("supplier_order_id").notNull(),
    status: text("status").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supplier_transactions_client_unique").on(
      table.supplierKey,
      table.clientTransactionId,
    ),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").$type<AuditMetadata>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_events_order_id_idx").on(table.orderId)],
);

export const orderAccessTokens = pgTable(
  "order_access_tokens",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("order_access_tokens_hash_unique").on(table.tokenHash),
    index("order_access_tokens_order_id_idx").on(table.orderId),
  ],
);

export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    template: text("template").notNull(),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    bodyText: text("body_text").notNull(),
    status: text("status").notNull().default("logged"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [index("email_events_order_id_idx").on(table.orderId)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: text("id").primaryKey(),
    topic: text("topic").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("outbox_events_status_next_idx").on(table.status, table.nextAttemptAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<AuditMetadata>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_created_at_idx").on(table.createdAt)],
);

export const activationAccessLogs = pgTable(
  "activation_access_logs",
  {
    id: text("id").primaryKey(),
    esimId: text("esim_id")
      .notNull()
      .references(() => esims.id, { onDelete: "cascade" }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activation_access_logs_esim_id_idx").on(table.esimId)],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    key: text("key").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (table) => [index("rate_limit_counters_window_start_idx").on(table.windowStart)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: text("purpose").notNull().default("password_reset"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_resets_user_id_idx").on(table.userId),
    index("password_resets_purpose_idx").on(table.purpose),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    status: text("status").notNull().default("issued"),
    subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invoices_order_unique").on(table.orderId),
    uniqueIndex("invoices_number_unique").on(table.number),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: text("payment_id").references(() => payments.id, { onDelete: "set null" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("requested"),
    providerRefundId: text("provider_refund_id"),
    resolutionNote: text("resolution_note").notNull().default(""),
    resolvedBy: text("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("refunds_idempotency_unique").on(table.idempotencyKey),
    index("refunds_order_id_idx").on(table.orderId),
  ],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    requesterEmail: text("requester_email").notNull().default(""),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("general"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("support_tickets_user_id_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status, table.updatedAt),
    index("support_tickets_assigned_idx").on(table.assignedTo),
  ],
);

export const supportMessages = pgTable(
  "support_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorType: text("author_type").notNull(),
    authorId: text("author_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("support_messages_ticket_id_idx").on(table.ticketId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [index("notifications_user_id_idx").on(table.userId)],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    productUpdatesOptIn: boolean("product_updates_opt_in").notNull().default(true),
    orderUpdatesOptIn: boolean("order_updates_opt_in").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_preferences_user_id_idx").on(table.userId)],
);

export const userConsents = pgTable(
  "user_consents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    version: text("version").notNull(),
    accepted: boolean("accepted").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_consents_user_purpose_version_unique").on(
      table.userId,
      table.purpose,
      table.version,
    ),
  ],
);

export const coupons = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    kind: text("kind").notNull(),
    value: integer("value").notNull(),
    status: text("status").notNull().default("disabled"),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    maxRedemptions: integer("max_redemptions"),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(true),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("coupons_code_unique").on(table.code)],
);

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: text("id").primaryKey(),
    couponId: text("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("coupon_redemptions_coupon_id_idx").on(table.couponId)],
);

export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    type: text("type").notNull(),
    value: integer("value").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("pricing_rules_code_unique").on(table.code)],
);

export const providers = pgTable(
  "providers",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    mode: text("mode").notNull().default("sandbox"),
    isMock: boolean("is_mock").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("providers_key_unique").on(table.key)],
);

export const providerPlans = pgTable(
  "provider_plans",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull(),
    supplierProductId: text("supplier_product_id").notNull(),
    planName: text("plan_name").notNull(),
    dataMb: integer("data_mb").notNull(),
    validityDays: integer("validity_days").notNull(),
    costMinor: bigint("cost_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    coverageSummary: text("coverage_summary").notNull(),
    networkSummary: text("network_summary").notNull(),
    status: text("status").notNull().default("active"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("provider_plans_provider_product_unique").on(
      table.providerKey,
      table.supplierProductId,
    ),
  ],
);

export const planPriceHistory = pgTable(
  "plan_price_history",
  {
    id: text("id").primaryKey(),
    supplierKey: text("supplier_key").notNull(),
    supplierProductId: text("supplier_product_id").notNull(),
    priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
    costMinor: bigint("cost_minor", { mode: "number" }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("plan_price_history_supplier_product_idx").on(table.supplierKey, table.supplierProductId)],
);

export const planAvailabilitySnapshots = pgTable(
  "plan_availability_snapshots",
  {
    id: text("id").primaryKey(),
    supplierKey: text("supplier_key").notNull(),
    supplierProductId: text("supplier_product_id").notNull(),
    available: boolean("available").notNull().default(false),
    dataMb: integer("data_mb"),
    validityDays: integer("validity_days"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plan_availability_supplier_product_unique").on(
      table.supplierKey,
      table.supplierProductId,
    ),
  ],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorType: text("actor_type").notNull().default("system"),
    actorId: text("actor_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("order_status_history_order_id_idx").on(table.orderId)],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("payment_events_payment_id_idx").on(table.paymentId)],
);

export const adminSettings = pgTable(
  "admin_settings",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("admin_settings_key_unique").on(table.key)],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("system_settings_key_unique").on(table.key)],
);

export const apiHealthChecks = pgTable(
  "api_health_checks",
  {
    id: text("id").primaryKey(),
    target: text("target").notNull(),
    method: text("method").notNull(),
    status: text("status").notNull(),
    responseCode: integer("response_code"),
    latencyMs: integer("latency_ms"),
    message: text("message"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("api_health_checks_checked_at_idx").on(table.checkedAt)],
);

export const providerSyncJobs = pgTable(
  "provider_sync_jobs",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("provider_sync_jobs_provider_key_idx").on(table.providerKey)],
);

export const providerBalanceSnapshots = pgTable(
  "provider_balance_snapshots",
  {
    id: text("id").primaryKey(),
    providerKey: text("provider_key").notNull(),
    balanceMinor: bigint("balance_minor", { mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("provider_balance_snapshots_provider_key_idx").on(table.providerKey)],
);

export type PasswordResetRow = typeof passwordResets.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;
export type SupportTicketRow = typeof supportTickets.$inferSelect;
export type SupportMessageRow = typeof supportMessages.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type UserConsentRow = typeof userConsents.$inferSelect;
export type CouponRow = typeof coupons.$inferSelect;
export type CouponRedemptionRow = typeof couponRedemptions.$inferSelect;
export type PricingRuleRow = typeof pricingRules.$inferSelect;
export type ProviderRow = typeof providers.$inferSelect;
export type ProviderPlanRow = typeof providerPlans.$inferSelect;
export type PlanPriceHistoryRow = typeof planPriceHistory.$inferSelect;
export type PlanAvailabilitySnapshotRow = typeof planAvailabilitySnapshots.$inferSelect;
export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
export type PaymentEventRow = typeof paymentEvents.$inferSelect;
export type AdminSettingRow = typeof adminSettings.$inferSelect;
export type SystemSettingRow = typeof systemSettings.$inferSelect;
export type LegalSettingsRow = typeof legalSettings.$inferSelect;
export type LegalDocumentVersionRow = typeof legalDocumentVersions.$inferSelect;
export type CookieConsentRow = typeof cookieConsents.$inferSelect;
export type ConsentEventRow = typeof consentEvents.$inferSelect;
export type PrivacyRequestRow = typeof privacyRequests.$inferSelect;
export type EmailSubscriptionRow = typeof emailSubscriptions.$inferSelect;
export type AssetLicenseRow = typeof assetLicenses.$inferSelect;
export type LegalThirdPartyRow = typeof legalThirdParties.$inferSelect;
export type DataRetentionSettingRow = typeof dataRetentionSettings.$inferSelect;
export type AccessibilityReviewRow = typeof accessibilityReviews.$inferSelect;
export type LegalReadinessItemRow = typeof legalReadinessItems.$inferSelect;
export type ApiHealthCheckRow = typeof apiHealthChecks.$inferSelect;
export type ProviderSyncJobRow = typeof providerSyncJobs.$inferSelect;
export type ProviderBalanceSnapshotRow = typeof providerBalanceSnapshots.$inferSelect;

export const seoSettings = pgTable(
  "seo_settings",
  {
    id: text("id").primaryKey().default("seo_global"),
    siteName: text("site_name").notNull().default(""),
    homepageTitle: text("homepage_title").notNull().default(""),
    homepageDescription: text("homepage_description").notNull().default(""),
    titleTemplate: text("title_template").notNull().default("{title} | {site_name}"),
    canonicalBase: text("canonical_base").notNull().default(""),
    defaultOgImage: text("default_og_image").notNull().default(""),
    defaultOgTitle: text("default_og_title").notNull().default(""),
    defaultOgDescription: text("default_og_description").notNull().default(""),
    logoUrl: text("logo_url").notNull().default(""),
    faviconUrl: text("favicon_url").notNull().default(""),
    organizationName: text("organization_name").notNull().default(""),
    organizationUrl: text("organization_url").notNull().default(""),
    organizationSameAs: text("organization_same_as").array().notNull().default([]),
    robotsDefault: text("robots_default").notNull().default("index, follow"),
    indexDefault: boolean("index_default").notNull().default(true),
    gscVerificationToken: text("gsc_verification_token"),
    gscProperty: text("gsc_property").notNull().default(""),
    ga4MeasurementId: text("ga4_measurement_id").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("seo_settings_id_unique").on(table.id)],
);

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blog_categories_slug_unique").on(table.slug)],
);

export const blogTags = pgTable(
  "blog_tags",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("blog_tags_slug_unique").on(table.slug)],
);

export const blogArticles = pgTable(
  "blog_articles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    bodyHtml: text("body_html").notNull().default(""),
    bodyText: text("body_text").notNull().default(""),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    categoryId: text("category_id").references(() => blogCategories.id, {
      onDelete: "set null",
    }),
    featuredImage: text("featured_image").notNull().default(""),
    featuredAlt: text("featured_alt").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    canonicalUrl: text("canonical_url").notNull().default(""),
    ogImage: text("og_image").notNull().default(""),
    robots: text("robots").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("blog_articles_slug_unique").on(table.slug),
    index("blog_articles_status_idx").on(table.status),
    index("blog_articles_published_at_idx").on(table.publishedAt),
    index("blog_articles_category_id_idx").on(table.categoryId),
    index("blog_articles_author_id_idx").on(table.authorId),
  ],
);

export const blogArticleTags = pgTable(
  "blog_article_tags",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => blogArticles.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => blogTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.articleId, table.tagId] })],
);

export const analyticsVisitors = pgTable(
  "analytics_visitors",
  {
    id: text("id").primaryKey(),
    visitorHash: text("visitor_hash").notNull(),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    sessionCount: integer("session_count").notNull().default(0),
    isInternal: boolean("is_internal").notNull().default(false),
  },
  (table) => [
    uniqueIndex("analytics_visitors_hash_unique").on(table.visitorHash),
    index("analytics_visitors_last_seen_idx").on(table.lastSeen),
  ],
);

export const analyticsSessions = pgTable(
  "analytics_sessions",
  {
    id: text("id").primaryKey(),
    sessionHash: text("session_hash").notNull(),
    visitorHash: text("visitor_hash").notNull().default(""),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    entryPath: text("entry_path").notNull().default("/"),
    exitPath: text("exit_path"),
    deviceType: text("device_type").notNull().default("unknown"),
    browser: text("browser").notNull().default("unknown"),
    os: text("os").notNull().default("unknown"),
    countryCode: text("country_code"),
    referrer: text("referrer"),
    source: text("source").notNull().default("direct"),
    isNew: boolean("is_new").notNull().default(true),
    isInternal: boolean("is_internal").notNull().default(false),
    pageViews: integer("page_views").notNull().default(0),
    events: integer("events").notNull().default(0),
  },
  (table) => [
    uniqueIndex("analytics_sessions_hash_unique").on(table.sessionHash),
    index("analytics_sessions_last_seen_idx").on(table.lastSeen),
    index("analytics_sessions_country_code_idx").on(table.countryCode),
    index("analytics_sessions_device_type_idx").on(table.deviceType),
    index("analytics_sessions_visitor_hash_idx").on(table.visitorHash),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => analyticsSessions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    pagePath: text("page_path").notNull().default("/"),
    pageTitle: text("page_title"),
    gameId: text("game_id"),
    countryCode: text("country_code"),
    deviceType: text("device_type").notNull().default("unknown"),
    browser: text("browser").notNull().default("unknown"),
    referrer: text("referrer"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("analytics_events_created_at_idx").on(table.createdAt),
    index("analytics_events_event_type_idx").on(table.eventType),
    index("analytics_events_session_id_idx").on(table.sessionId),
    index("analytics_events_game_id_idx").on(table.gameId),
    index("analytics_events_page_path_idx").on(table.pagePath),
    index("analytics_events_country_code_idx").on(table.countryCode),
    index("analytics_events_internal_idx").on(table.isInternal),
  ],
);

export const legalSettings = pgTable(
  "legal_settings",
  {
    id: text("id").primaryKey().default("legal_global"),
    legalName: text("legal_name").notNull().default(""),
    tradingName: text("trading_name").notNull().default(""),
    registrationNumber: text("registration_number").notNull().default(""),
    registeredAddress: text("registered_address").notNull().default(""),
    businessCountry: text("business_country").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    supportEmail: text("support_email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    legalContact: text("legal_contact").notNull().default(""),
    privacyContact: text("privacy_contact").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    vatNumber: text("vat_number").notNull().default(""),
    taxDetails: text("tax_details").notNull().default(""),
    minimumAge: integer("minimum_age"),
    minimumAgeNote: text("minimum_age_note").notNull().default(""),
    termsVersion: text("terms_version").notNull().default("draft-2026-11-07"),
    privacyVersion: text("privacy_version").notNull().default("draft-2026-11-07"),
    refundsVersion: text("refunds_version").notNull().default("draft-2026-11-07"),
    cookiesVersion: text("cookies_version").notNull().default("draft-2026-11-07"),
    accessibilityVersion: text("accessibility_version").notNull().default("draft-2026-11-07"),
    termsEffectiveDate: text("terms_effective_date"),
    privacyEffectiveDate: text("privacy_effective_date"),
    refundsEffectiveDate: text("refunds_effective_date"),
    cookiesEffectiveDate: text("cookies_effective_date"),
    accessibilityEffectiveDate: text("accessibility_effective_date"),
    termsReviewStatus: text("terms_review_status").notNull().default("needs_legal_review"),
    privacyReviewStatus: text("privacy_review_status").notNull().default("needs_legal_review"),
    refundsReviewStatus: text("refunds_review_status").notNull().default("needs_legal_review"),
    cookiesReviewStatus: text("cookies_review_status").notNull().default("needs_legal_review"),
    accessibilityReviewStatus: text("accessibility_review_status").notNull().default("needs_legal_review"),
    cookieConsentVersion: text("cookie_consent_version").notNull().default("2026-11-07"),
    marketingConsentVersion: text("marketing_consent_version").notNull().default("2026-11-07"),
    refundReviewNotes: text("refund_review_notes").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("legal_settings_id_unique").on(table.id)],
);

export const legalDocumentVersions = pgTable(
  "legal_document_versions",
  {
    id: text("id").primaryKey(),
    documentKey: text("document_key").notNull(),
    version: text("version").notNull(),
    effectiveDate: text("effective_date"),
    status: text("status").notNull().default("needs_legal_review"),
    summary: text("summary").notNull().default(""),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legal_document_versions_key_version_unique").on(
      table.documentKey,
      table.version,
    ),
    index("legal_document_versions_key_idx").on(table.documentKey),
  ],
);

export const cookieConsents = pgTable(
  "cookie_consents",
  {
    id: text("id").primaryKey(),
    subjectHash: text("subject_hash").notNull(),
    consentVersion: text("consent_version").notNull(),
    analytics: boolean("analytics").notNull().default(false),
    marketing: boolean("marketing").notNull().default(false),
    action: text("action").notNull().default("custom"),
    countryCode: text("country_code"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cookie_consents_subject_unique").on(table.subjectHash),
    index("cookie_consents_updated_at_idx").on(table.updatedAt),
  ],
);

export const consentEvents = pgTable(
  "consent_events",
  {
    id: text("id").primaryKey(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    purpose: text("purpose").notNull(),
    version: text("version").notNull(),
    granted: boolean("granted").notNull(),
    surface: text("surface").notNull().default(""),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("consent_events_subject_idx").on(table.subjectType, table.subjectId),
    index("consent_events_purpose_idx").on(table.purpose, table.createdAt),
    index("consent_events_created_at_idx").on(table.createdAt),
  ],
);

export const privacyRequests = pgTable(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull(),
    requestType: text("request_type").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("pending_verification"),
    identityStatus: text("identity_status").notNull().default("unverified"),
    verificationTokenHash: text("verification_token_hash"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    resolution: text("resolution").notNull().default(""),
    rejectionReason: text("rejection_reason").notNull().default(""),
    adminNotes: text("admin_notes").notNull().default(""),
    handledBy: text("handled_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("privacy_requests_reference_unique").on(table.reference),
    index("privacy_requests_status_idx").on(table.status, table.createdAt),
    index("privacy_requests_email_idx").on(table.email),
  ],
);

export const emailSubscriptions = pgTable(
  "email_subscriptions",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("subscribed"),
    source: text("source").notNull().default(""),
    consentVersion: text("consent_version").notNull().default(""),
    unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    unsubscribeReason: text("unsubscribe_reason").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_subscriptions_email_unique").on(table.email),
    uniqueIndex("email_subscriptions_token_unique").on(table.unsubscribeTokenHash),
    index("email_subscriptions_status_idx").on(table.status),
  ],
);

export const assetLicenses = pgTable(
  "asset_licenses",
  {
    id: text("id").primaryKey(),
    assetKey: text("asset_key").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    location: text("location").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    licenseName: text("license_name").notNull().default(""),
    licenseUrl: text("license_url").notNull().default(""),
    attribution: text("attribution").notNull().default(""),
    commercialUse: text("commercial_use").notNull().default("unknown"),
    redistribution: text("redistribution").notNull().default("unknown"),
    status: text("status").notNull().default("needs_verification"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("asset_licenses_key_unique").on(table.assetKey)],
);

export const legalThirdParties = pgTable(
  "legal_third_parties",
  {
    id: text("id").primaryKey(),
    serviceKey: text("service_key").notNull(),
    provider: text("provider").notNull(),
    purpose: text("purpose").notNull(),
    dataShared: text("data_shared").notNull().default(""),
    cookies: text("cookies").notNull().default(""),
    runsBeforeConsent: boolean("runs_before_consent").notNull().default(false),
    necessary: boolean("necessary").notNull().default(false),
    optional: boolean("optional").notNull().default(false),
    internationalTransfer: text("international_transfer").notNull().default("unknown"),
    configurationNotes: text("configuration_notes").notNull().default(""),
    status: text("status").notNull().default("not_verified"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("legal_third_parties_key_unique").on(table.serviceKey)],
);

export const dataRetentionSettings = pgTable(
  "data_retention_settings",
  {
    id: text("id").primaryKey(),
    dataKey: text("data_key").notNull(),
    label: text("label").notNull(),
    retentionDays: integer("retention_days"),
    basis: text("basis").notNull().default("owner_decision_required"),
    automated: boolean("automated").notNull().default(false),
    enabled: boolean("enabled").notNull().default(false),
    notes: text("notes").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("data_retention_key_unique").on(table.dataKey)],
);

export const accessibilityReviews = pgTable(
  "accessibility_reviews",
  {
    id: text("id").primaryKey(),
    area: text("area").notNull(),
    status: text("status").notNull().default("not_verified"),
    wcagLevel: text("wcag_level").notNull().default("AA"),
    findings: text("findings").notNull().default(""),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    checkedBy: text("checked_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("accessibility_reviews_area_unique").on(table.area)],
);

export const legalReadinessItems = pgTable(
  "legal_readiness_items",
  {
    id: text("id").primaryKey(),
    itemKey: text("item_key").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull().default("legal"),
    status: text("status").notNull().default("needs_owner_information"),
    owner: text("owner").notNull().default(""),
    notes: text("notes").notNull().default(""),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("legal_readiness_items_key_unique").on(table.itemKey)],
);

export const supplierConnections = pgTable(
  "supplier_connections",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    adapterType: text("adapter_type").notNull(),
    environment: text("environment").notNull().default("sandbox"),
    baseUrl: text("base_url").notNull(),
    authMethod: text("auth_method").notNull().default("api_key"),
    enabled: boolean("enabled").notNull().default(false),
    status: text("status").notNull().default("disconnected"),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastErrorSafe: text("last_error_safe"),
    credentialEncrypted: jsonb("credential_encrypted").$type<EncryptedSecret>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supplier_connections_display_unique").on(table.displayName),
    index("supplier_connections_adapter_idx").on(table.adapterType),
    index("supplier_connections_env_idx").on(table.environment),
  ],
);

export const supplierCapabilities = pgTable(
  "supplier_capabilities",
  {
    id: text("id").primaryKey(),
    supplierKey: text("supplier_key").notNull(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => supplierConnections.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    status: text("status").notNull().default("unknown"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supplier_caps_connection_capability_unique").on(
      table.connectionId,
      table.capability,
    ),
    index("supplier_caps_status_idx").on(table.status),
  ],
);

export const schema = {
  users,
  sessions,
  regions,
  destinations,
  plans,
  carts,
  cartItems,
  orders,
  orderItems,
  payments,
  webhookEvents,
  fulfillmentJobs,
  esims,
  supplierTransactions,
  orderEvents,
  orderAccessTokens,
  emailEvents,
  outboxEvents,
  auditLogs,
  activationAccessLogs,
  rateLimitCounters,
  passwordResets,
  invoices,
  refunds,
  supportTickets,
  supportMessages,
  notifications,
  userPreferences,
  userConsents,
  coupons,
  couponRedemptions,
  pricingRules,
  providers,
  providerPlans,
  planPriceHistory,
  planAvailabilitySnapshots,
  orderStatusHistory,
  paymentEvents,
  adminSettings,
  systemSettings,
  apiHealthChecks,
  providerSyncJobs,
  providerBalanceSnapshots,
  seoSettings,
  blogCategories,
  blogTags,
  blogArticles,
  blogArticleTags,
  analyticsVisitors,
  analyticsSessions,
  analyticsEvents,
  supplierConnections,
  supplierCapabilities,
};

export type SeoSettingsRow = typeof seoSettings.$inferSelect;
export type BlogCategoryRow = typeof blogCategories.$inferSelect;
export type BlogTagRow = typeof blogTags.$inferSelect;
export type BlogArticleRow = typeof blogArticles.$inferSelect;
export type BlogArticleTagRow = typeof blogArticleTags.$inferSelect;
export type AnalyticsSessionRow = typeof analyticsSessions.$inferSelect;
export type AnalyticsVisitorRow = typeof analyticsVisitors.$inferSelect;
export type AnalyticsEventRow = typeof analyticsEvents.$inferSelect;
export type SupplierConnectionRow = typeof supplierConnections.$inferSelect;
export type SupplierCapabilityRow = typeof supplierCapabilities.$inferSelect;

export type Schema = typeof schema;
