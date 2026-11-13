import { supabase } from "./supabase";

export type Profile = { id: string; full_name: string | null; phone: string | null; email?: string | null; role: "customer" | "support" | "driver" | "admin"; identifier_code?: string | null; delivery_preference?: "pickup" | "delivery"; shipment_status_emails?: boolean; delivery_reminders?: boolean; us_address_line1?: string; us_address_city?: string; us_address_state?: string; us_address_zip?: string };
export type Shipment = { id: string; tracking_number: string; status: string; origin: string; destination: string; estimated_delivery: string | null; created_at: string; invoice_uploaded: boolean };
export type TrackingEvent = { id: string; package_id: string; status: string; description: string | null; location: string | null; created_at: string };
export type SupportTicket = { id: string; subject: string; category: string; priority: string; message: string; status: string; created_at: string };
export type AdminNotification = { id: string; type: string; title: string; body: string; read_at: string | null; created_at: string };
export type Invoice = { id: string; invoice_number: string; amount: number; currency: string; status: string; due_date: string | null; created_at: string };
export type AuthorizedPickupPerson = { id: string; user_id: string; full_name: string; phone: string; relationship: string | null; id_type: "national_id" | "drivers_license" | "passport" | "other"; id_document_path: string; created_at: string };
export type Announcement = { id: string; title: string; body: string; category: "service_update" | "promotion" | "holiday" | "maintenance" | "shipping_tip"; template: "banner" | "promotion" | "service_update" | "maintenance" | "shipping_tip" | "invoice_reminder"; status: "draft" | "active" | "paused" | "archived"; audience: "all" | "customer" | "staff"; starts_at: string | null; ends_at: string | null; priority: number; cta_label: string | null; cta_url: string | null; animation: "none" | "fade" | "slide"; countdown: boolean; image_url?: string | null; created_at: string; updated_at: string };

function requireClient() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
export async function getSession() { return requireClient().auth.getSession(); }
export async function signIn(email: string, password: string) { return requireClient().auth.signInWithPassword({ email, password }); }
export async function signUp(email: string, password: string, fullName: string, whatsappNumber?: string) { return requireClient().auth.signUp({ email, password, options: { data: { full_name: fullName, phone: whatsappNumber || null } } }); }
export async function signOut() { return requireClient().auth.signOut(); }
export async function getProfile(userId: string) { return requireClient().from("profiles").select("*").eq("id", userId).single<Profile>(); }
export async function listProfiles() { return requireClient().from("profiles").select("id,full_name,phone,email,role,identifier_code,delivery_preference,pickup_location,us_address_line1,us_address_city,us_address_state,us_address_zip,created_at").order("created_at", { ascending: false }); }
export async function updateUserRole(userId: string, role: "customer" | "support" | "admin") { return requireClient().from("profiles").update({ role }).eq("id", userId).select().single<Profile>(); }
export async function updateProfile(userId: string, values: { full_name: string; phone: string | null; shipment_status_emails: boolean; delivery_reminders: boolean }) { return requireClient().from("profiles").update(values).eq("id", userId).select().single<Profile>(); }
export async function updateDeliveryPreference(userId: string, deliveryPreference: "pickup" | "delivery") { return requireClient().from("profiles").update({ delivery_preference: deliveryPreference }).eq("id", userId).select().single(); }
export async function updateEmail(email: string) { return requireClient().auth.updateUser({ email }); }
export async function updatePassword(password: string) { return requireClient().auth.updateUser({ password }); }
export async function listShipments(userId: string) { return requireClient().from("packages").select("id,tracking_number,status,origin,destination,estimated_delivery,created_at,invoice_uploaded").eq("customer_id", userId).order("created_at", { ascending: false }).returns<Shipment[]>(); }
export async function listAllShipments() { return requireClient().from("packages").select("id,customer_id,tracking_number,status,origin,destination,estimated_delivery,created_at,invoice_uploaded,customer_name,customer_email,customer_phone,collection_amount_jmd,weight_lb,freight_type,profiles:customer_id(full_name,phone)").order("created_at", { ascending: false }).returns<Shipment[]>(); }
export async function createPackage(packageData: { customer_id: string; tracking_number: string; origin: string; destination: string; status: string; service_level: string; weight_kg: number | null; estimated_delivery: string | null; customer_name?: string | null; customer_email?: string | null; customer_phone?: string | null }) {
  return requireClient().from("packages").insert(packageData).select("id,customer_id,tracking_number,status,origin,destination,estimated_delivery,created_at,invoice_uploaded,customer_name,customer_email,customer_phone,collection_amount_jmd,weight_lb,freight_type").single();
}
export async function deletePackage(packageId: string) { return requireClient().from("packages").delete().eq("id", packageId); }
export async function listSiteSettings() { return requireClient().from("site_settings").select("key,value").order("key"); }
export async function saveSiteSetting(key: string, value: unknown, userId: string) { return requireClient().from("site_settings").upsert({ key, value, updated_by: userId }).select().single(); }
export async function listShippingServices() { return requireClient().from("shipping_services").select("id,name,description,service_type,active,created_at").order("name"); }
export async function createShippingService(service: { name: string; description: string; service_type: string }) { return requireClient().from("shipping_services").insert({ ...service, active: true }).select().single(); }
export async function updateShippingService(id: string, values: { name: string; description: string; service_type: string; active: boolean }) { return requireClient().from("shipping_services").update(values).eq("id", id).select().single(); }
export async function recordPayment(payment: { package_id: string; customer_id: string; amount: number; payment_type: "cash" | "card"; received_by: string }) {
  return requireClient().from("payments").insert({ package_id: payment.package_id, customer_id: payment.customer_id, amount: payment.amount, currency: "JMD", payment_type: payment.payment_type, status: "paid", received_by: payment.received_by }).select().single();
}
export async function sendPaymentReceipt(paymentId: string) {
  const session = await requireClient().auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("Your admin session has expired.");
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!apiUrl) throw new Error("Payment email delivery is not configured.");
  const response = await fetch(`${apiUrl}/payment-receipts/${paymentId}/receipt`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Unable to send payment receipt.");
}
export async function syncFreightForwarderAccount() {
  const session = await requireClient().auth.getSession();
  const token = session.data.session?.access_token;
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!token || !apiUrl) return;
  const response = await fetch(`${apiUrl}/freight-forwarder/register`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to register your shipping address with the freight forwarder.");
}
export async function sendWarehousePackageEmail(packageId: string) {
  const session = await requireClient().auth.getSession();
  const token = session.data.session?.access_token;
  const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (!token || !apiUrl) throw new Error("Email delivery is not configured.");
  const response = await fetch(`${apiUrl}/package-notifications/${packageId}/warehouse-email`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json() as { error?: string }).error || "Unable to send warehouse email.");
}
export function calculateCollectionAmount(weightLb: number, freightType: "air" | "sea") {
  const pounds = Math.ceil(weightLb);
  const air = pounds === 1 ? 750 : pounds === 2 ? 1155 : Math.round(1754 + (pounds - 3) * 520.2);
  return freightType === "sea" ? Math.round(air * (560 / 750)) : air;
}
export async function updatePackageWeight(packageId: string, weightLb: number, freightType: "air" | "sea") {
  const collectionAmount = calculateCollectionAmount(weightLb, freightType);
  return requireClient().from("packages").update({ weight_lb: weightLb, freight_type: freightType, collection_amount_jmd: collectionAmount }).eq("id", packageId).select("id,weight_lb,freight_type,collection_amount_jmd").single();
}
export async function listTrackingEvents(packageId: string) { return requireClient().from("tracking_events").select("id,package_id,status,description,location,created_at").eq("package_id", packageId).order("created_at", { ascending: true }).returns<TrackingEvent[]>(); }
export async function updateShipmentMilestone(packageId: string, status: string, description: string, location: string) {
  const client = requireClient();
  const updated = await client.from("packages").update({ status }).eq("id", packageId);
  if (updated.error) return updated;
  return client.from("tracking_events").insert({ package_id: packageId, status, description, location }).select().single<TrackingEvent>();
}
export async function updatePackageInvoice(packageId: string, userId: string, filePath: string) {
  const client = requireClient();
  const { error: packageError } = await client.from("packages").update({ invoice_uploaded: true }).eq("id", packageId).eq("customer_id", userId);
  if (packageError) return { error: packageError };
  return client.from("invoices").insert({ customer_id: userId, package_id: packageId, invoice_number: `UPLOAD-${Date.now()}`, amount: 0, currency: "USD", status: "uploaded", file_path: filePath }).select().single();
}
export async function uploadInvoiceFile(userId: string, packageId: string, file: File) {
  const path = `${userId}/${packageId}/${crypto.randomUUID()}-${file.name}`;
  const result = await requireClient().storage.from("invoices").upload(path, file, { upsert: false, contentType: file.type });
  return { ...result, path };
}
export async function listInvoices(userId: string) { return requireClient().from("invoices").select("*").eq("customer_id", userId).order("created_at", { ascending: false }).returns<Invoice[]>(); }
export async function listSupportTickets(userId: string) { return requireClient().from("support_tickets").select("*").eq("customer_id", userId).order("created_at", { ascending: false }).returns<SupportTicket[]>(); }
export async function listAllSupportTickets() { return requireClient().from("support_tickets").select("*,profiles:customer_id(full_name,email,phone)").order("created_at", { ascending: false }).returns<SupportTicket[]>(); }
export async function listAllInvoices() { return requireClient().from("invoices").select("id,invoice_number,status,amount,currency,file_path,created_at").order("created_at", { ascending: false }); }
export async function getInvoiceDownloadUrl(filePath: string) { return requireClient().storage.from("invoices").createSignedUrl(filePath, 300); }
export async function listAuthorizedPickupPersons(userId: string) {
  return requireClient().from("authorized_pickup_persons").select("id,user_id,full_name,phone,relationship,id_type,id_document_path,created_at").eq("user_id", userId).order("created_at", { ascending: false }).returns<AuthorizedPickupPerson[]>();
}
export async function createAuthorizedPickupPerson(userId: string, person: Pick<AuthorizedPickupPerson, "full_name" | "phone" | "relationship" | "id_type">, file: File) {
  const client = requireClient();
  const personId = crypto.randomUUID();
  const safeFileName = file.name.replace(/[^\w.-]/g, "_");
  const path = `${userId}/${personId}/${crypto.randomUUID()}-${safeFileName}`;
  const uploaded = await client.storage.from("authorized-pickup-ids").upload(path, file, { upsert: false, contentType: file.type });
  if (uploaded.error) return { data: null, error: uploaded.error };
  const inserted = await client.from("authorized_pickup_persons").insert({
    id: personId,
    user_id: userId,
    ...person,
    id_document_path: path,
  }).select("id,user_id,full_name,phone,relationship,id_type,id_document_path,created_at").single<AuthorizedPickupPerson>();
  if (inserted.error) {
    const cleanup = await client.storage.from("authorized-pickup-ids").remove([path]);
    if (cleanup.error) throw new Error(`${inserted.error.message} The uploaded identification file could not be cleaned up: ${cleanup.error.message}`);
  }
  return inserted;
}
export async function getAuthorizedPickupIdUrl(filePath: string) { return requireClient().storage.from("authorized-pickup-ids").createSignedUrl(filePath, 300); }
export async function deleteInvoice(id: string) { return requireClient().from("invoices").delete().eq("id", id); }
export async function deletePayment(id: string) { return requireClient().from("payments").delete().eq("id", id); }
export async function listNotifications(userId: string) { return requireClient().from("notifications").select("id,type,title,body,read_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50).returns<AdminNotification[]>(); }
export async function markNotificationRead(notificationId: string) { return requireClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId); }
export async function listAllPayments() { return requireClient().from("payments").select("id,package_id,customer_id,amount,currency,status,payment_type,created_at").order("created_at", { ascending: false }); }
export async function createSupportTicket(userId: string, ticket: Pick<SupportTicket, "subject" | "category" | "priority" | "message">) {
  return requireClient().from("support_tickets").insert({ customer_id: userId, ...ticket }).select().single<SupportTicket>();
}
export async function listPublicAnnouncements() { return requireClient().from("announcements").select("id,title,body,category,template,status,audience,starts_at,ends_at,priority,cta_label,cta_url,animation,countdown,image_url,created_at,updated_at").eq("status", "active").in("audience", ["all", "customer"]).or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).order("priority", { ascending: false }).returns<Announcement[]>(); }
export async function listAnnouncements() { return requireClient().from("announcements").select("*").order("priority", { ascending: false }).order("created_at", { ascending: false }).returns<Announcement[]>(); }
export async function createAnnouncement(values: Partial<Announcement>) { return requireClient().from("announcements").insert(values).select().single<Announcement>(); }
export async function updateAnnouncement(id: string, values: Partial<Announcement>) { return requireClient().from("announcements").update(values).eq("id", id).select().single<Announcement>(); }
export async function deleteAnnouncement(id: string) { return requireClient().from("announcements").delete().eq("id", id); }
