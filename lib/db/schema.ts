import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
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

export const rateLimitCounters = pgTable("rate_limit_counters", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

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
};

export type Schema = typeof schema;
