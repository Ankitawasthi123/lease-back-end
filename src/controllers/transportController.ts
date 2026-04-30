import { Request, Response } from "express";
import { Op } from "sequelize";
import Transport from "../models/Transport";
import User from "../models/User";
import { sendErrorResponse } from "../utils/errorResponse";

let isTransportSynced = false;

const ensureTransportTable = async () => {
  if (!isTransportSynced) {
    await Transport.sync();
    isTransportSynced = true;
  }
};

const validateThreeplUser = async (req: Request, res: Response) => {
  const tokenUserId = req.user?.id ?? req.user?.login_id ?? req.user?.userId;
  const numericUserId = tokenUserId ? Number(tokenUserId) : NaN;

  if (!numericUserId || Number.isNaN(numericUserId)) {
    sendErrorResponse(res, 401, "User not authenticated");
    return null;
  }

  const user = await User.findByPk(numericUserId);
  if (!user) {
    sendErrorResponse(res, 404, "User not found");
    return null;
  }

  const roleValue = String(req.user?.role || user.role || "").toLowerCase();
  if (roleValue !== "threepl") {
    sendErrorResponse(res, 403, "Only threepl users can access this endpoint");
    return null;
  }

  return user;
};

const cleanQueryValue = (value: unknown) => {
  if (value == null) {
    return null;
  }

  const cleaned = String(value).trim();
  if (!cleaned || cleaned === "all" || cleaned === "null" || cleaned === "undefined") {
    return null;
  }

  return cleaned;
};

const getTransportLocationValues = (transport: any) => {
  const slabs = Array.isArray(transport.owner_risk_slab) ? transport.owner_risk_slab : [];

  return slabs
    .flatMap((slab: any) => {
      const fromPoint = slab?.from;
      const toPoint = slab?.to;
      return [fromPoint, toPoint];
    })
    .filter((point: any) => point && typeof point === "object")
    .map((point: any) =>
      String(point.display_name || point.name || point.address?.city || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
};

const getTransportCompanyIdentifier = (transport: any) => {
  const normalizedCompany = normalizeTransportCompanyDetails(transport.company_details);
  if (normalizedCompany?.data.company_id != null) {
    return Number(normalizedCompany.data.company_id);
  }

  const transportId = Number(transport.id);
  return Number.isNaN(transportId) ? null : transportId;
};

const matchesTransportFilters = (transport: any, filters: {
  companyId: number | null;
  companyName: string | null;
  location: string | null;
}) => {
  const normalizedCompany = normalizeTransportCompanyDetails(transport.company_details);
  const transportCompanyId = getTransportCompanyIdentifier(transport);

  if (filters.companyId != null && transportCompanyId !== filters.companyId) {
    return false;
  }

  if (filters.companyName) {
    const currentCompanyName = String(normalizedCompany?.data.company_name || "").trim().toLowerCase();
    if (!currentCompanyName.includes(filters.companyName)) {
      return false;
    }
  }

  if (filters.location) {
    const locationValues = getTransportLocationValues(transport);
    if (!locationValues.some((value: string) => value.includes(filters.location!))) {
      return false;
    }
  }

  return true;
};

const normalizeTransportCompanyDetails = (companyDetails: any) => {
  if (!companyDetails || typeof companyDetails !== "object") {
    return null;
  }

  const companyIdRaw =
    companyDetails.id ?? companyDetails.company_id ?? companyDetails.companyId ?? null;
  const companyId = companyIdRaw != null && !Number.isNaN(Number(companyIdRaw))
    ? Number(companyIdRaw)
    : null;

  const companyName =
    companyDetails.company_name ?? companyDetails.companyName ?? companyDetails.name ?? null;
  const emailId = companyDetails.email_id ?? companyDetails.emailId ?? null;
  const contactNo = companyDetails.contact_no ?? companyDetails.contactNo ?? null;
  const gstNo = companyDetails.gst_no ?? companyDetails.gstNo ?? null;
  const contactPersonName =
    companyDetails.contact_person_name ?? companyDetails.contactPersonName ?? null;

  const uniqueKey = companyId
    ? `id_${companyId}`
    : [companyName, emailId, contactNo, gstNo]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join("|");

  if (!uniqueKey) {
    return null;
  }

  return {
    uniqueKey,
    data: {
      company_id: companyId,
      company_name: companyName,
      email_id: emailId,
      contact_no: contactNo,
      gst_no: gstNo,
      contact_person_name: contactPersonName,
      company_details: companyDetails,
    },
  };
};

const mapTransportPayload = (payload: any) => ({
  company_details:
    payload.companyDetails ??
    payload.company_details ??
    payload.comapnyDetails ??
    payload.comapny_details ??
    {},
  transport_mode: payload.transportMode ?? payload.transport_mode ?? {},
  service_type: payload.serviceType ?? payload.service_type ?? {},
  rate_type: payload.rateTypes ?? payload.rateType ?? payload.rate_type ?? {},
  minimum_freight_type_basewise:
    payload.minimumFreightTypeBaseWise ?? payload.minimum_freight_type_basewise ?? {},
  charges: payload.charges ?? {},
  demurrage_information: payload.demurrageInformation ?? payload.demurrage_information ?? {},
  freight_related_services:
    payload.freightRelatedServices ?? payload.freight_related_services ?? {},
  matrices: payload.matrices ?? {},
  pickup_delivery: payload.pickupDelivery ?? payload.pickup_delivery ?? {},
  volumetric: payload.volumetric ?? {},
  risk_information: payload.riskInformation ?? payload.risk_information ?? {},
  owner_risk_slab: payload.ownerRiskSlab ?? payload.owner_risk_slab ?? [],
});

export const createTransport = async (req: Request, res: Response) => {
  try {
    await ensureTransportTable();

    const now = new Date().toISOString();
    const mapped = mapTransportPayload(req.body || {});

    const transport = await Transport.create({
      ...mapped,
      status: req.body?.status || "submitted",
      created_at: now,
      updated_at: now,
    });

    return res.status(201).json({
      success: true,
      message: "Transport created successfully",
      data: transport.toJSON(),
    });
  } catch (err: any) {
    console.error("Create transport error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create transport", err);
  }
};

export const getTransportById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return sendErrorResponse(res, 400, "id is required and must be numeric");
  }

  try {
    await ensureTransportTable();

    const transport = await Transport.findByPk(Number(id));
    if (!transport) {
      return sendErrorResponse(res, 404, "Transport not found");
    }

    return res.status(200).json({
      success: true,
      data: transport.toJSON(),
    });
  } catch (err: any) {
    console.error("Get transport error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch transport", err);
  }
};

export const getTransportList = async (_req: Request, res: Response) => {
  try {
    await ensureTransportTable();

    const transports = await Transport.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: transports.map((item) => item.toJSON()),
    });
  } catch (err: any) {
    console.error("Get transport list error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch transport list", err);
  }
};

export const getApprovedTransportsForOwnerAndAgent = async (
  req: Request,
  res: Response,
) => {
  try {
    await ensureTransportTable();

    const authorizedUser = await validateThreeplUser(req, res);
    if (!authorizedUser) {
      return;
    }

    const companyIdValue = cleanQueryValue(req.query.company_id ?? req.query.companyId);
    const companyId =
      companyIdValue && !Number.isNaN(Number(companyIdValue))
        ? Number(companyIdValue)
        : null;
    const companyName =
      cleanQueryValue(req.query.company_name ?? req.query.companyName)?.toLowerCase() || null;
    const location = cleanQueryValue(req.query.location)?.toLowerCase() || null;

    const transports = await Transport.findAll({
      where: { status: { [Op.iLike]: "approved" } },
      order: [["id", "DESC"]],
    });

    const filteredTransports =
      companyId == null && companyName == null && location == null
        ? transports
        : transports.filter((transport: any) =>
            matchesTransportFilters(transport, { companyId, companyName, location }),
          );

    return res.status(200).json({
      success: true,
      count: filteredTransports.length,
      data: filteredTransports.map((t) => t.toJSON()),
    });
  } catch (err: any) {
    console.error("Get approved transport list error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch approved transport list", err);
  }
};

export const getApprovedTransportCompanyList = async (
  req: Request,
  res: Response,
) => {
  try {
    await ensureTransportTable();

    const authorizedUser = await validateThreeplUser(req, res);
    if (!authorizedUser) {
      return;
    }

    const transports = await Transport.findAll({
      where: {
        status: { [Op.iLike]: "approved" },
      },
      attributes: ["id", "company_details"],
      order: [["id", "DESC"]],
    });

    const companyIdValue = cleanQueryValue(req.query.company_id ?? req.query.companyId);
    const companyIdFilter =
      companyIdValue && !Number.isNaN(Number(companyIdValue))
        ? Number(companyIdValue)
        : null;

    const uniqueCompanies = new Map<string, any>();

    transports.forEach((transport: any) => {
      const normalized = normalizeTransportCompanyDetails(transport.company_details);
      const transportCompanyId = getTransportCompanyIdentifier(transport);

      if (companyIdFilter != null && transportCompanyId !== companyIdFilter) {
        return;
      }

      if (!normalized || uniqueCompanies.has(normalized.uniqueKey)) {
        return;
      }

      uniqueCompanies.set(normalized.uniqueKey, {
        id: transportCompanyId,
        company_name: normalized.data.company_name,
      });
    });

    return res.status(200).json({
      success: true,
      count: uniqueCompanies.size,
      data: Array.from(uniqueCompanies.values()),
    });
  } catch (err: any) {
    console.error("Get transport company list error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch transport company list", err);
  }
};

export const updateTransport = async (req: Request, res: Response) => {
  const id = req.body?.id;

  if (!id || isNaN(Number(id))) {
    return sendErrorResponse(res, 400, "id is required and must be numeric");
  }

  try {
    await ensureTransportTable();

    const transport = await Transport.findByPk(Number(id));
    if (!transport) {
      return sendErrorResponse(res, 404, "Transport not found");
    }

    const mapped = mapTransportPayload(req.body || {});

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    const body = req.body || {};

    if (
      Object.prototype.hasOwnProperty.call(body, "companyDetails") ||
      Object.prototype.hasOwnProperty.call(body, "company_details") ||
      Object.prototype.hasOwnProperty.call(body, "comapnyDetails") ||
      Object.prototype.hasOwnProperty.call(body, "comapny_details")
    ) {
      updates.company_details = mapped.company_details;
    }

    if (Object.prototype.hasOwnProperty.call(body, "transportMode") || Object.prototype.hasOwnProperty.call(body, "transport_mode")) {
      updates.transport_mode = mapped.transport_mode;
    }

    if (Object.prototype.hasOwnProperty.call(body, "serviceType") || Object.prototype.hasOwnProperty.call(body, "service_type")) {
      updates.service_type = mapped.service_type;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "rateTypes") ||
      Object.prototype.hasOwnProperty.call(body, "rateType") ||
      Object.prototype.hasOwnProperty.call(body, "rate_type")
    ) {
      updates.rate_type = mapped.rate_type;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "minimumFreightTypeBaseWise") ||
      Object.prototype.hasOwnProperty.call(body, "minimum_freight_type_basewise")
    ) {
      updates.minimum_freight_type_basewise = mapped.minimum_freight_type_basewise;
    }

    if (Object.prototype.hasOwnProperty.call(body, "charges")) {
      updates.charges = mapped.charges;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "demurrageInformation") ||
      Object.prototype.hasOwnProperty.call(body, "demurrage_information")
    ) {
      updates.demurrage_information = mapped.demurrage_information;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "freightRelatedServices") ||
      Object.prototype.hasOwnProperty.call(body, "freight_related_services")
    ) {
      updates.freight_related_services = mapped.freight_related_services;
    }

    if (Object.prototype.hasOwnProperty.call(body, "matrices")) {
      updates.matrices = mapped.matrices;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "pickupDelivery") ||
      Object.prototype.hasOwnProperty.call(body, "pickup_delivery")
    ) {
      updates.pickup_delivery = mapped.pickup_delivery;
    }

    if (Object.prototype.hasOwnProperty.call(body, "volumetric")) {
      updates.volumetric = mapped.volumetric;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "riskInformation") ||
      Object.prototype.hasOwnProperty.call(body, "risk_information")
    ) {
      updates.risk_information = mapped.risk_information;
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "ownerRiskSlab") ||
      Object.prototype.hasOwnProperty.call(body, "owner_risk_slab")
    ) {
      updates.owner_risk_slab = mapped.owner_risk_slab;
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      updates.status = body.status || "submitted";
    }

    await transport.update(updates);

    return res.status(200).json({
      success: true,
      message: "Transport updated successfully",
      data: transport.toJSON(),
    });
  } catch (err: any) {
    console.error("Update transport error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update transport", err);
  }
};

export const deleteTransport = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || isNaN(Number(id))) {
    return sendErrorResponse(res, 400, "id is required and must be numeric");
  }

  try {
    await ensureTransportTable();

    const transport = await Transport.findByPk(Number(id));
    if (!transport) {
      return sendErrorResponse(res, 404, "Transport not found");
    }

    await transport.destroy();

    return res.status(200).json({
      success: true,
      message: "Transport deleted successfully",
    });
  } catch (err: any) {
    console.error("Delete transport error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete transport", err);
  }
};

export const getTransportUniqueLocationList = async (req: Request, res: Response) => {
  try {
    await ensureTransportTable();

    const tokenUserId = req.user?.id ?? req.user?.login_id ?? req.user?.userId;
    const numericUserId = tokenUserId ? Number(tokenUserId) : NaN;

    if (!numericUserId || Number.isNaN(numericUserId)) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    const user = await User.findByPk(numericUserId);
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const roleValue = String(req.user?.role || user.role || "").toLowerCase();
    if (roleValue !== "company") {
      return sendErrorResponse(res, 403, "Only company users can access this endpoint");
    }

    const transports = await Transport.findAll({
      attributes: ["owner_risk_slab"],
      order: [["id", "DESC"]],
    });

    const unique = new Map<string, any>();

    transports.forEach((transport: any) => {
      const slabs = Array.isArray(transport.owner_risk_slab)
        ? transport.owner_risk_slab
        : [];

      slabs.forEach((slab: any) => {
        const point = slab?.from;

        if (!point || typeof point !== "object") {
          return;
        }

        const key = point.place_id
          ? `place_${point.place_id}`
          : String(point.display_name || point.name || "").trim().toLowerCase();

        if (!key) {
          return;
        }

        if (!unique.has(key)) {
          unique.set(key, {
            place_id: point.place_id ?? null,
            name: point.name ?? null,
            display_name: point.display_name ?? null,
            lat: point.lat ?? null,
            lon: point.lon ?? null,
            address: point.address ?? null,
          });
        }
      });
    });

    return res.status(200).json({
      success: true,
      count: unique.size,
      locations: Array.from(unique.values()),
    });
  } catch (err: any) {
    console.error("Get transport unique locations error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch unique locations", err);
  }
};
