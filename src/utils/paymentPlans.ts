export interface PaymentPlanDetails {
  plan: string;
  category: string | null;
  duration: string | null;
  requirementView: string | null;
  requirementPitch: string;
  price: number;
}

interface ResolvePaymentPlanInput {
  amount?: unknown;
  plan?: unknown;
  selectedPlan?: unknown;
  serviceFor?: unknown;
  role?: unknown;
  notes?: any;
  callbackPayload?: any;
}

const THREE_PL_PLANS: PaymentPlanDetails[] = [
  { plan: "Starter", category: "3PL", duration: "1 Month", requirementView: "Unlimited", requirementPitch: "30", price: 4999 },
  { plan: "Growth", category: "3PL", duration: "3 Months", requirementView: "Unlimited", requirementPitch: "120", price: 11999 },
  { plan: "Business", category: "3PL", duration: "6 Months", requirementView: "Unlimited", requirementPitch: "300", price: 21999 },
  { plan: "Enterprise", category: "3PL", duration: "12 Months", requirementView: "Unlimited", requirementPitch: "Unlimited", price: 49999 },
];

const WAREHOUSE_PLANS: PaymentPlanDetails[] = [
  { plan: "Starter", category: "Warehouse Consultant", duration: null, requirementView: null, requirementPitch: "20", price: 3999 },
  { plan: "Growth", category: "Warehouse Consultant", duration: null, requirementView: null, requirementPitch: "80", price: 9999 },
  { plan: "Business", category: "Warehouse Consultant", duration: null, requirementView: null, requirementPitch: "200", price: 17999 },
  { plan: "Premium", category: "Warehouse Consultant", duration: null, requirementView: null, requirementPitch: "Unlimited", price: 39999 },
];

const MANPOWER_PLANS: PaymentPlanDetails[] = [
  { plan: "Starter", category: "Manpower Contractor", duration: null, requirementView: null, requirementPitch: "15", price: 3999 },
  { plan: "Growth", category: "Manpower Contractor", duration: null, requirementView: null, requirementPitch: "75", price: 9999 },
  { plan: "Business", category: "Manpower Contractor", duration: null, requirementView: null, requirementPitch: "180", price: 17999 },
  { plan: "Premium", category: "Manpower Contractor", duration: null, requirementView: null, requirementPitch: "Unlimited", price: 39999 },
];

const normalize = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") : "";

const pickString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const getPlanFamily = (category: unknown, role: unknown): PaymentPlanDetails[] | null => {
  const normalized = normalize(category) || normalize(role);

  if (["3pl", "threepl", "transport", "transportcompany"].includes(normalized)) {
    return THREE_PL_PLANS;
  }

  if (["manpower", "manpowercontractor", "contractor"].includes(normalized)) {
    return MANPOWER_PLANS;
  }

  if (
    [
      "warehouse",
      "warehouseconsultant",
      "industrialshed",
      "industrialshedconsultant",
      "retail",
      "retailconsultant",
    ].includes(normalized)
  ) {
    return WAREHOUSE_PLANS;
  }

  return null;
};

const withCategory = (details: PaymentPlanDetails, category: unknown): PaymentPlanDetails => {
  const normalized = normalize(category);
  if (["transport", "transportcompany"].includes(normalized)) {
    return { ...details, category: "Transport Company" };
  }
  if (["industrialshed", "industrialshedconsultant"].includes(normalized)) {
    return { ...details, category: "Industrial Shed Consultant" };
  }
  if (["retail", "retailconsultant"].includes(normalized)) {
    return { ...details, category: "Retail Consultant" };
  }
  return details;
};

const findPlanByName = (plans: PaymentPlanDetails[], planName: string): PaymentPlanDetails | null => {
  const normalizedPlan = normalize(planName);
  return plans.find((item) => normalize(item.plan) === normalizedPlan) || null;
};

const findPlanByAmount = (plans: PaymentPlanDetails[], amount: number): PaymentPlanDetails | null =>
  plans.find((item) => Math.abs(item.price - amount) < 0.01) || null;

export const resolvePaymentPlanDetails = (input: ResolvePaymentPlanInput): PaymentPlanDetails | null => {
  const notes = input.notes || {};
  const callbackPayload = input.callbackPayload || {};
  const category = pickString(
    input.serviceFor,
    notes.service_for,
    notes.serviceFor,
    notes.category,
    callbackPayload.service_for,
    callbackPayload.serviceFor,
    callbackPayload.category
  );
  const role = pickString(input.role, notes.role, callbackPayload.role);
  const requestedPlan = pickString(
    input.plan,
    input.selectedPlan,
    notes.plan,
    notes.selected_plan,
    notes.selectedPlan,
    callbackPayload.plan,
    callbackPayload.selected_plan,
    callbackPayload.selectedPlan
  );
  const amount = input.amount === undefined || input.amount === null ? NaN : Number(input.amount);
  const family = getPlanFamily(category, role);

  if (!Number.isNaN(amount) && (Math.abs(amount - 1) < 0.01 || Math.abs(amount - 1.18) < 0.01)) {
    return withCategory((family || WAREHOUSE_PLANS)[0], category || role);
  }

  if (requestedPlan && family) {
    const details = findPlanByName(family, requestedPlan);
    if (details) return withCategory(details, category || role);
  }

  if (!Number.isNaN(amount)) {
    if (family) {
      const details = findPlanByAmount(family, amount);
      if (details) return withCategory(details, category || role);
    }

    const details =
      findPlanByAmount(THREE_PL_PLANS, amount) ||
      findPlanByAmount(WAREHOUSE_PLANS, amount) ||
      findPlanByAmount(MANPOWER_PLANS, amount);
    if (details) return withCategory(details, category || role);
  }

  if (requestedPlan) {
    const details =
      findPlanByName(family || [], requestedPlan) ||
      findPlanByName(THREE_PL_PLANS, requestedPlan) ||
      findPlanByName(WAREHOUSE_PLANS, requestedPlan) ||
      findPlanByName(MANPOWER_PLANS, requestedPlan);
    if (details) return withCategory(details, category || role);
  }

  return null;
};

export const resolvePaymentPlanName = (input: ResolvePaymentPlanInput): string | null =>
  resolvePaymentPlanDetails(input)?.plan || null;
