/**
 * The pricing tools. Each is the owner's original stand-alone page
 * (pricing-tools/<id>/index.html), served by app/pricing/tool/[tool] with a
 * bootstrap that swaps browser-only storage for the shared database.
 *
 * `sharedKeys` are the tool's own storage keys that hold settings/catalog —
 * saved in the database for everyone, writable only with the Pricing PIN.
 * Anything else a tool stores (the quote being worked on) stays in that
 * browser, so two people quoting at once never overwrite each other.
 */
export interface PricingTool {
  id: "lightbox" | "neon" | "tapela" | "hanger";
  title: string;
  icon: string;
  desc: string;
  sharedKeys: string[];
}

export const PRICING_TOOLS: PricingTool[] = [
  {
    id: "lightbox",
    title: "Lightbox Sign Pricing",
    icon: "🧮",
    desc: "Lightbox quotes and full material cost breakdowns, with invoices and a protected Settings catalog.",
    sharedKeys: [
      "hadar_items_v1",
      "hadar_mica_formula_v1",
      "hadar_led_formula_v1",
      "hadar_relief_formula_v1",
      "hadar_metal_formula_v1",
      "hadar_conditional_rules_v1",
      "hadar_company_info_v1",
      "hadar_invoice_settings_v1",
    ],
  },
  {
    id: "neon",
    title: "Neon Sign Pricing",
    icon: "💡",
    desc: "Pick readymade neon sign designs and standard sizes, or approximate a custom size, then generate an invoice.",
    sharedKeys: ["neon-pricing-settings", "neon-pricing-images"],
  },
  {
    id: "tapela",
    title: "Tapela Sign Pricing",
    icon: "🔲",
    desc: "Pick readymade tapela sign designs and standard sizes, or approximate a custom size, then generate an invoice.",
    sharedKeys: ["tapela-pricing-settings", "tapela-pricing-images"],
  },
  {
    id: "hanger",
    title: "Hanger Sign Pricing",
    icon: "🪧",
    desc: "Readymade hanger signs or a custom size, with UV Board and Colour Board add-ons, then generate an invoice.",
    sharedKeys: ["hanger-pricing-settings", "hanger-pricing-images"],
  },
];

export function findTool(id: string): PricingTool | null {
  return PRICING_TOOLS.find((t) => t.id === id) ?? null;
}

/** Invoice-number prefix per tool, matching the original tools. */
export const COUNTER_PREFIX: Record<PricingTool["id"], string> = {
  lightbox: "INV",
  neon: "NEON",
  tapela: "TAPELA",
  hanger: "HANG",
};
