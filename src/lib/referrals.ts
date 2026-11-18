import { supabase } from "./supabase";

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { data, error } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error(error?.message || "Your session has expired. Sign in again.");
  if (!apiUrl) throw new Error("Referral management is not configured.");
  const response = await fetch(`${apiUrl}/referrals${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json() as { data?: T; error?: string };
  if (!response.ok || result.data === undefined) throw new Error(result.error || "Unable to complete referral request.");
  return result.data;
}

export type ReferralSummary = {
  profile: { name: string; referral_code: string; discount_eligible: boolean; program_enabled: boolean; discount_per_lb: number; free_delivery_enabled: boolean };
  statistics: { total_referred: number; registered: number; awaiting_first_shipment: number; successful: number; benefits_earned_jmd: number };
  referrals: { id: string; referred_customer: string; created_at: string; status: string; first_shipment_status: string; reward_activated_at: string | null }[];
};

export type ReferralManagement = {
  settings: { enabled: boolean; discount_per_lb: number; referrer_activation: "registration" | "first_paid_shipment"; free_delivery_enabled: boolean };
  areas: { id: string; community: string; parish: string; enabled: boolean }[];
  statistics: {
    total_codes: number; registered_referrals: number; successful_referrals: number; pending_activations: number;
    eligible_customers: number; discounts_applied_jmd: number; referred_shipping_revenue_jmd: number;
    top_referrers: { customer: string; referral_code: string; successful_referrals: number }[];
  };
  referrals: {
    id: string; referrer_id: string; referred_id: string; referrer: string; referrer_code: string; referred_customer: string; registered_at: string; status: string;
    first_paid_shipment_at: string | null; discount_eligible: boolean; referrer_eligible: boolean;
  }[];
  customers: {
    id: string; name: string; referral_code: string; discount_eligible: boolean;
    free_delivery_override: boolean | null; referred_by_id: string | null; city_town: string | null;
    parish: string | null; free_delivery_eligible: boolean; created_at: string;
  }[];
  page: number;
  page_size: number;
  total_referrals: number;
};

export const getReferralSummary = () => request<ReferralSummary>("/me");
export async function validateReferralCode(code: string) {
  if (!apiUrl) throw new Error("Referral validation is not configured.");
  const response = await fetch(`${apiUrl}/referrals/validate/${encodeURIComponent(code.trim().toUpperCase())}`);
  const result = await response.json() as { data?: { valid: boolean }; error?: string };
  if (!response.ok || !result.data) throw new Error(result.error || "Unable to validate the referral code.");
  return result.data;
}
export const getReferralManagement = (page = 0, search = "", status = "all") =>
  request<ReferralManagement>(`/management?page=${page}&pageSize=50&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`);
export const updateReferralSettings = (settings: ReferralManagement["settings"]) =>
  request<ReferralManagement["settings"]>("/management/settings", "PATCH", settings);
export const addReferralDeliveryArea = (community: string, parish: string) =>
  request<ReferralManagement["areas"][number]>("/management/areas", "POST", { community, parish });
export const removeReferralDeliveryArea = (areaId: string) =>
  request<void>(`/management/areas/${areaId}`, "DELETE");
export const updateReferralCustomerEligibility = (
  customerId: string,
  values: { discount_eligible?: boolean; free_delivery_override?: boolean | null },
) => request(`/management/customers/${customerId}`, "PATCH", values);
