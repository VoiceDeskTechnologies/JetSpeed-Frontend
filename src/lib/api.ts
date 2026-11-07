const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

export async function trackPackage(trackingNumber: string): Promise<{ status: string; destination: string }> {
  if (!API_URL) {
    return { status: "in transit", destination: "Kingston" };
  }

  const response = await fetch(`${API_URL}/packages/tracking/${encodeURIComponent(trackingNumber)}`);
  if (!response.ok) {
    throw new Error("Unable to retrieve tracking information.");
  }

  const payload = (await response.json()) as { data?: { status?: string; destination?: string } };
  const data = payload.data;
  if (!data?.status) {
    throw new Error("Tracking service returned an invalid response.");
  }
  return { status: data.status, destination: data.destination ?? "Kingston" };
}
