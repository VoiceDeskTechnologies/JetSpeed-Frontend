import { supabase } from "./supabase";

export type Profile = { id: string; full_name: string | null; phone: string | null; role: "customer" | "support" | "driver" | "admin" };
export type Shipment = { id: string; tracking_number: string; status: string; origin: string; destination: string; estimated_delivery: string | null; created_at: string; invoice_uploaded: boolean };
export type TrackingEvent = { id: string; package_id: string; status: string; description: string | null; location: string | null; created_at: string };
export type SupportTicket = { id: string; subject: string; category: string; priority: string; message: string; status: string; created_at: string };
export type Invoice = { id: string; invoice_number: string; amount: number; currency: string; status: string; due_date: string | null; created_at: string };

function requireClient() { if (!supabase) throw new Error("Supabase is not configured."); return supabase; }
export async function getSession() { return requireClient().auth.getSession(); }
export async function signIn(email: string, password: string) { return requireClient().auth.signInWithPassword({ email, password }); }
export async function signUp(email: string, password: string, fullName: string, whatsappNumber?: string) { return requireClient().auth.signUp({ email, password, options: { data: { full_name: fullName, phone: whatsappNumber || null } } }); }
export async function signOut() { return requireClient().auth.signOut(); }
export async function getProfile(userId: string) { return requireClient().from("profiles").select("*").eq("id", userId).single<Profile>(); }
export async function listProfiles() { return requireClient().from("profiles").select("id,full_name,phone,role,created_at").order("created_at", { ascending: false }); }
export async function updateUserRole(userId: string, role: "customer" | "support" | "admin") { return requireClient().from("profiles").update({ role }).eq("id", userId).select().single<Profile>(); }
export async function updateProfile(userId: string, values: { full_name: string; phone: string | null }) { return requireClient().from("profiles").update(values).eq("id", userId).select().single<Profile>(); }
export async function listShipments(userId: string) { return requireClient().from("packages").select("id,tracking_number,status,origin,destination,estimated_delivery,created_at,invoice_uploaded").eq("customer_id", userId).order("created_at", { ascending: false }).returns<Shipment[]>(); }
export async function listAllShipments() { return requireClient().from("packages").select("id,customer_id,tracking_number,status,origin,destination,estimated_delivery,created_at,invoice_uploaded,customer_name,customer_email,customer_phone,collection_amount_jmd,weight_lb,freight_type,profiles:customer_id(full_name,phone)").order("created_at", { ascending: false }).returns<Shipment[]>(); }
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
export async function listAllSupportTickets() { return requireClient().from("support_tickets").select("*").order("created_at", { ascending: false }).returns<SupportTicket[]>(); }
export async function listAllPayments() { return requireClient().from("payments").select("id,package_id,customer_id,amount,currency,status,payment_type,created_at").order("created_at", { ascending: false }); }
export async function createSupportTicket(userId: string, ticket: Pick<SupportTicket, "subject" | "category" | "priority" | "message">) {
  return requireClient().from("support_tickets").insert({ customer_id: userId, ...ticket }).select().single<SupportTicket>();
}
