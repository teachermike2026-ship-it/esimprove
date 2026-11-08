"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db/client";
import { supplierConnections } from "@/lib/db/schema";
import { createConnection } from "@/lib/adapters/connection-store";
import { encryptSupplierCredential } from "@/lib/adapters/encryption";
import { validateConnectionUrl } from "@/lib/adapters/ssrf-guard";
import { newId } from "@/lib/ids";
import { recordAudit } from "@/lib/audit";
import { formString, supplierConnectionSchema, zodMessage } from "@/lib/validation";

function backWithError(message: string): never {
  redirect(`/admin/integrations/new?error=${encodeURIComponent(message)}`);
}

export async function createSupplierConnectionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/integrations", "integrations.manage");

  const parsed = supplierConnectionSchema.safeParse({
    displayName: formString(formData, "displayName"),
    adapterType: formString(formData, "adapterType"),
    environment: formString(formData, "environment"),
    baseUrl: formString(formData, "baseUrl"),
    authMethod: formString(formData, "authMethod"),
    credentialSecret: formString(formData, "credentialSecret"),
  });
  if (!parsed.success) return backWithError(zodMessage(parsed.error));

  const validatedUrl = validateConnectionUrl(parsed.data.baseUrl);
  if (!validatedUrl.safe || !validatedUrl.url) {
    return backWithError(validatedUrl.error ?? "Base URL is not allowed");
  }
  if (parsed.data.environment === "production" && !validatedUrl.url.startsWith("https://")) {
    return backWithError("Production supplier connections require an HTTPS base URL");
  }

  const db = await getDb();
  const existing = await db
    .select({ id: supplierConnections.id })
    .from(supplierConnections)
    .where(eq(supplierConnections.displayName, parsed.data.displayName))
    .limit(1);
  if (existing.length > 0) {
    return backWithError("A connection with this display name already exists");
  }

  const connectionId = newId("supplier");
  let credentialEncrypted;
  try {
    credentialEncrypted = encryptSupplierCredential(
      connectionId,
      parsed.data.credentialSecret,
    );
  } catch {
    // Never include key material or a stack trace in a user-facing message.
    return backWithError("Supplier credentials could not be encrypted. Check server key configuration.");
  }

  try {
    await createConnection({
      id: connectionId,
      displayName: parsed.data.displayName,
      adapterType: parsed.data.adapterType.toLowerCase(),
      environment: parsed.data.environment,
      baseUrl: validatedUrl.url,
      authMethod: parsed.data.authMethod,
      credentialEncrypted,
    });
  } catch {
    return backWithError("The supplier connection could not be saved");
  }

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.integration.create",
    entityType: "supplier_connection",
    entityId: connectionId,
    metadata: {
      adapterType: parsed.data.adapterType.toLowerCase(),
      environment: parsed.data.environment,
      authMethod: parsed.data.authMethod,
      // Deliberately no credential, URL query string, or ciphertext.
    },
  });

  revalidatePath("/admin/integrations");
  redirect("/admin/integrations?created=1");
}
