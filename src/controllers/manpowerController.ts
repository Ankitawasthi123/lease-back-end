import { Request, Response } from "express";
import { Op, QueryTypes, Sequelize } from "sequelize";
import sequelize from "../config/data-source";
import ManpowerRequirement from "../models/ManpowerRequirement";
import ManpowerBid from "../models/ManpowerBid";
import ManpowerBidAward from "../models/ManpowerBidAward";
import User from "../models/User";
import { sendErrorResponse } from "../utils/errorResponse";

let isManpowerSynced = false;
let manpowerRequirementPkColumn: string | null = null;

const ensureManpowerTables = async () => {
  if (!isManpowerSynced) {
    await ManpowerRequirement.sync();
    await ManpowerBid.sync();
    await ManpowerBidAward.sync();
    isManpowerSynced = true;
  }
};

const safeParseJson = <T = any>(value: any, fallback: T): T => {
  if (value === undefined || value === null || value === "" || value === "null" || value === "undefined") {
    return fallback;
  }

  if (typeof value === "object") {
    return value as T;
  }

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const getManpowerRequirementPkColumn = async () => {
  if (manpowerRequirementPkColumn) {
    return manpowerRequirementPkColumn;
  }

  const columns = await sequelize.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'manpower_requirements'
        AND column_name IN ('id', 'manpower_requirement_id')
      ORDER BY CASE column_name WHEN 'id' THEN 1 ELSE 2 END
    `,
    { type: QueryTypes.SELECT },
  );

  const columnNames = (columns as any[]).map((column) => column.column_name);
  manpowerRequirementPkColumn = columnNames.includes("id")
    ? "id"
    : columnNames.includes("manpower_requirement_id")
      ? "manpower_requirement_id"
      : "id";

  return manpowerRequirementPkColumn;
};

const getParsedBody = (req: Request) => {
  const parsedData = safeParseJson(req.body?.data, {});
  return {
    ...req.body,
    ...(parsedData && typeof parsedData === "object" ? parsedData : {}),
  };
};

const getUserId = (req: Request, body: any, keys: string[]) => {
  for (const key of keys) {
    const value = body?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const tokenId = req.user?.id ?? req.user?.login_id ?? req.user?.userId ?? req.user?.user_id;
  return tokenId !== undefined && tokenId !== null ? String(tokenId).trim() : "";
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const numericIdPattern = /^\d+$/;

const isUuid = (value: string) => uuidPattern.test(value);

const numericIdToUuid = (value: string) =>
  `00000000-0000-4000-8000-${value.padStart(12, "0").slice(-12)}`;

const normalizeUserReference = (value: string) => {
  const cleanValue = String(value || "").trim();
  if (isUuid(cleanValue)) {
    return cleanValue.toLowerCase();
  }

  if (numericIdPattern.test(cleanValue)) {
    return numericIdToUuid(cleanValue);
  }

  return null;
};

const validateUserReference = (res: Response, value: string, fieldName: string) => {
  if (!value) {
    sendErrorResponse(res, 401, `${fieldName} is required`);
    return null;
  }

  const normalizedValue = normalizeUserReference(value);
  if (!normalizedValue) {
    sendErrorResponse(res, 400, `${fieldName} must be a valid UUID or numeric user id`);
    return null;
  }

  return normalizedValue;
};

const getRole = (req: Request, body?: any) =>
  String(body?.role || req.user?.role || "").trim().toLowerCase();

const resolveRequestRole = async (req: Request, body?: any) => {
  const providedRole = getRole(req, body);
  if (providedRole) {
    return providedRole;
  }

  const rawUserId =
    body?.login_id ??
    body?.loginId ??
    body?.user_id ??
    body?.userId ??
    req.user?.id ??
    req.user?.userId ??
    req.user?.login_id;
  const userId = Number(rawUserId);
  if (!Number.isFinite(userId)) {
    return "";
  }

  const user = await User.findByPk(userId, { attributes: ["role"] });
  return String(user?.role || "").trim().toLowerCase();
};

const isCompanyRole = (role: string) => role === "company";
const isAdminRole = (role: string) => role === "admin";
const isContractorRole = (role: string) =>
  ["contractor", "contractors", "contracter", "contractore", "threepl", "3pl", "three_pl"].includes(role);

const uploadedFilePath = (req: Request, fieldNames: string[]) => {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  for (const fieldName of fieldNames) {
    const file = files?.[fieldName]?.[0];
    if (file?.filename) {
      return `/uploads/manpower/${file.filename}`;
    }
  }
  return null;
};

const applyBidFileUploads = (req: Request, documents: any, declaration: any) => {
  const documentUploadFields = [
    {
      key: "company_profile_pdf_path",
      fields: ["company_profile", "company_profile_pdf", "company_profile_pdf_path"],
    },
    {
      key: "client_list_path",
      fields: ["client_list", "client_list_file", "client_list_path"],
    },
    {
      key: "safety_certificate_path",
      fields: ["safety_certificate", "safety_certificate_file", "safety_certificate_path"],
    },
    {
      key: "iso_path",
      fields: ["iso", "iso_file", "iso_path"],
    },
  ];

  for (const uploadField of documentUploadFields) {
    const filePath = uploadedFilePath(req, uploadField.fields);
    if (filePath) {
      documents[uploadField.key] = filePath;
    }
  }

  const signatoryPath = uploadedFilePath(req, ["authorized_signatory", "authorized_signatory_path"]);
  const stampPath = uploadedFilePath(req, ["company_stamp", "company_stamp_path"]);

  if (signatoryPath) {
    declaration.authorized_signatory_path = signatoryPath;
  }
  if (stampPath) {
    declaration.company_stamp_path = stampPath;
  }
};

const toNumber = (value: any) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const calculateBid = (quotationRows: any[], marginCharges: any) => {
  const commercialQuotation = (Array.isArray(quotationRows) ? quotationRows : []).map((row) => {
    const qty = toNumber(row?.qty);
    const contractorRateMonthly = toNumber(
      row?.contractor_rate_monthly ?? row?.contractorRateMonthly,
    );
    const serviceChargePercent = toNumber(
      row?.service_charge_percent ?? row?.serviceChargePercent,
    );
    const labourAmount = qty * contractorRateMonthly;
    const serviceChargeAmount = (labourAmount * serviceChargePercent) / 100;
    const totalAmount = labourAmount + serviceChargeAmount;

    return {
      ...row,
      qty,
      contractor_rate_monthly: contractorRateMonthly,
      labour_amount: labourAmount,
      service_charge_percent: serviceChargePercent,
      service_charge_amount: serviceChargeAmount,
      total_amount: totalAmount,
    };
  });

  const totalMonthlyLabourCost = commercialQuotation.reduce(
    (sum, row) => sum + toNumber(row.labour_amount),
    0,
  );
  const monthlyServiceChargeTotal = commercialQuotation.reduce(
    (sum, row) => sum + toNumber(row.service_charge_amount),
    0,
  );
  const otherCharges = Object.values(marginCharges || {}).reduce(
    (sum: number, value) => sum + toNumber(value),
    0,
  );
  const gst = (totalMonthlyLabourCost + monthlyServiceChargeTotal + otherCharges) * 0.18;
  const finalMonthlyQuotation =
    totalMonthlyLabourCost + monthlyServiceChargeTotal + otherCharges + gst;

  return {
    commercialQuotation,
    commercialSummary: {
      total_monthly_labour_cost: totalMonthlyLabourCost,
      monthly_service_charge_total: monthlyServiceChargeTotal,
      gst,
      other_charges: otherCharges,
      final_monthly_quotation: finalMonthlyQuotation,
      yearly_cost: finalMonthlyQuotation * 12,
    },
  };
};

const generateRequirementId = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MP-${date}-${suffix}`;
};

const maskCompanyContact = (requirementJson: any) => {
  const companyDetails = { ...(requirementJson.company_details || {}) };
  delete companyDetails.contact_person;
  delete companyDetails.designation;
  delete companyDetails.mobile_number;
  delete companyDetails.email;

  return {
    ...requirementJson,
    company_details: companyDetails,
  };
};

const hasAwardForContractor = async (requirementId: string, contractorId: string) => {
  const contractorDbId = normalizeUserReference(contractorId);
  if (!contractorDbId) {
    return false;
  }

  const rows = await sequelize.query(
    `
      SELECT 1
      FROM public.manpower_bid_awards
      WHERE manpower_requirement_id = :requirementId
        AND contractor_id = :contractorId
        AND status = 'awarded'
      LIMIT 1
    `,
    {
      replacements: {
        requirementId,
        contractorId: contractorDbId,
      },
      type: QueryTypes.SELECT,
    },
  );
  return rows.length > 0;
};

const findRequirementByIdentifier = async (identifier: string) => {
  const value = String(identifier || "").trim();
  if (!value) {
    return null;
  }

  if (isUuid(value)) {
    return ManpowerRequirement.findByPk(value);
  }

  return ManpowerRequirement.findOne({
    where: { requirement_id: value },
  });
};

const findExistingManpowerBidRow = async (
  manpowerRequirementId: string,
  contractorId: string,
) => {
  const rows = await sequelize.query(
    `
      SELECT *
      FROM public.manpower_bids
      WHERE manpower_requirement_id = :manpowerRequirementId
        AND contractor_id = :contractorId
      LIMIT 1
    `,
    {
      replacements: {
        manpowerRequirementId,
        contractorId,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0] || null;
};

const insertManpowerBidRow = async (payload: {
  manpowerRequirementId: string;
  contractorId: string;
  status: string;
  commercialQuotation: any[];
  marginCharges: any;
  commercialSummary: any;
  contractorCapability: any;
  documents: any;
  declaration: any;
}) => {
  const rows = await sequelize.query(
    `
      INSERT INTO public.manpower_bids (
        bid_id,
        manpower_requirement_id,
        contractor_id,
        status,
        commercial_quotation,
        margin_charges,
        commercial_summary,
        contractor_capability,
        documents,
        declaration
      )
      VALUES (
        gen_random_uuid(),
        :manpowerRequirementId,
        :contractorId,
        :status,
        CAST(:commercialQuotation AS jsonb),
        CAST(:marginCharges AS jsonb),
        CAST(:commercialSummary AS jsonb),
        CAST(:contractorCapability AS jsonb),
        CAST(:documents AS jsonb),
        CAST(:declaration AS jsonb)
      )
      RETURNING *
    `,
    {
      replacements: {
        manpowerRequirementId: payload.manpowerRequirementId,
        contractorId: payload.contractorId,
        status: payload.status,
        commercialQuotation: JSON.stringify(payload.commercialQuotation),
        marginCharges: JSON.stringify(payload.marginCharges),
        commercialSummary: JSON.stringify(payload.commercialSummary),
        contractorCapability: JSON.stringify(payload.contractorCapability),
        documents: JSON.stringify(payload.documents),
        declaration: JSON.stringify(payload.declaration),
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows[0];
};

const withBidId = (bid: any) => ({
  ...bid,
  bid_id: bid?.bid_id,
});

const getManpowerBidCounts = async (requirementIds: string[]) => {
  if (!requirementIds.length) {
    return new Map<string, number>();
  }

  const rows = await sequelize.query(
    `
      SELECT manpower_requirement_id, COUNT(*)::int AS bid_count
      FROM public.manpower_bids
      WHERE manpower_requirement_id IN (:requirementIds)
      GROUP BY manpower_requirement_id
    `,
    {
      replacements: { requirementIds },
      type: QueryTypes.SELECT,
    },
  );

  return new Map(
    (rows as any[]).map((row) => [
      String(row.manpower_requirement_id),
      Number(row.bid_count || 0),
    ]),
  );
};

const getRequirementBidsWithContractorCompany = async (requirementId: string) => {
  return sequelize.query(
    `
      SELECT
        mb.*,
        u.company_name AS contractor_company_name,
        CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name) AS contractor_name,
        u.email AS contractor_email,
        u.contact_number AS contractor_contact_number
      FROM public.manpower_bids mb
      LEFT JOIN public.users u
        ON u.id = CASE
          WHEN mb.contractor_id::text LIKE '00000000-0000-4000-8000-%'
          THEN NULLIF(
            regexp_replace(
              mb.contractor_id::text,
              '^00000000-0000-4000-8000-0*',
              ''
            ),
            ''
          )::int
          ELSE NULL
        END
      WHERE mb.manpower_requirement_id = :requirementId
      ORDER BY (mb.commercial_summary ->> 'final_monthly_quotation')::numeric ASC NULLS LAST,
        mb.created_at ASC
    `,
    {
      replacements: { requirementId },
      type: QueryTypes.SELECT,
    },
  );
};

const parseBidWindowDate = (dateValue: any, timeValue: any) => {
  if (!dateValue) {
    return null;
  }

  const dateText = String(dateValue).trim();
  const timeText = String(timeValue || "00:00").trim();
  const meridianMatch = timeText.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  let hour = 0;
  let minute = 0;

  if (meridianMatch) {
    hour = Number(meridianMatch[1]);
    minute = Number(meridianMatch[2] || 0);
    const meridian = meridianMatch[3].toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
  } else {
    const [rawHour, rawMinute = "0"] = timeText.split(":");
    hour = Number(rawHour);
    minute = Number(rawMinute);
  }

  const parsed = new Date(`${dateText}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isBidClosed = (requirement: any) => {
  const terms = requirement?.commercial_terms || {};
  const closingDate = parseBidWindowDate(
    terms.tender_closing_date,
    terms.online_bid_end_time || "23:59",
  );
  return closingDate ? closingDate.getTime() < Date.now() : false;
};

const serializeRequirementForUser = async (requirement: any, role: string, userId: string) => {
  const json = requirement.toJSON();
  if (isContractorRole(role) && !(await hasAwardForContractor(json.id, userId))) {
    return maskCompanyContact(json);
  }
  return json;
};

export const createManpowerRequirement = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const companyId = getUserId(req, body, ["company_id", "companyId", "login_id", "loginId"]);
    const role = getRole(req, body);
    const companyDbId = validateUserReference(res, companyId, "company_id");

    if (!companyDbId) return;
    if (role && !isCompanyRole(role)) {
      return sendErrorResponse(res, 403, "Only company users can create manpower requirements");
    }

    const requirement = await ManpowerRequirement.create({
      requirement_id: body.requirement_id || generateRequirementId(),
      company_id: companyDbId,
      status: body.status || "submitted",
      company_details: safeParseJson(body.company_details ?? body.companyDetails, {}),
      requirement_details: safeParseJson(body.requirement_details ?? body.requirementDetails, {}),
      manpower_rows: safeParseJson(body.manpower_rows ?? body.manpowerRows, []),
      industry_categories: safeParseJson(body.industry_categories ?? body.industryCategories, []),
      preferred_industry_experience: safeParseJson(
        body.preferred_industry_experience ?? body.preferredIndustryExperience,
        [],
      ),
      contractor_scope: safeParseJson(body.contractor_scope ?? body.contractorScope, []),
      commercial_terms: safeParseJson(body.commercial_terms ?? body.commercialTerms, {}),
      supporting_pdf_path: uploadedFilePath(req, [
        "supporting_pdf",
        "supporting_document",
        "requirement_supporting_pdf",
        "pdf_file",
      ]),
      additional_notes: body.additional_notes ?? body.additionalNotes ?? null,
    });

    return res.status(201).json({
      success: true,
      message: "Manpower requirement created successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Create manpower requirement error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create manpower requirement", err);
  }
};

export const getManpowerRequirements = async (req: Request, res: Response) => {
  try {
    const body = getParsedBody(req);
    const role = await resolveRequestRole(req, { ...body, ...req.query });
    const pkColumn = await getManpowerRequirementPkColumn();
    const hasCompanyId =
      req.query.company_id !== undefined ||
      req.query.companyId !== undefined ||
      body.company_id !== undefined ||
      body.companyId !== undefined;
    const hasContractorId =
      req.query.contractor_id !== undefined ||
      req.query.contractorId !== undefined ||
      body.contractor_id !== undefined ||
      body.contractorId !== undefined;
    const isAdminUser = isAdminRole(role);
    const isCompanyUser = isCompanyRole(role) || (!role && hasCompanyId && !hasContractorId);
    const isContractorUser =
      isContractorRole(role) || (!isAdminUser && !isCompanyUser && (hasContractorId || !hasCompanyId));

    const requesterId = isCompanyUser
      ? getUserId(req, { ...body, ...req.query }, [
          "company_id",
          "companyId",
          "login_id",
          "loginId",
          "user_id",
          "userId",
        ])
      : getUserId(req, { ...body, ...req.query }, [
          "contractor_id",
          "contractorId",
          "login_id",
          "loginId",
          "user_id",
          "userId",
        ]);
    const requesterDbId = normalizeUserReference(requesterId);

    const status = String(req.query.status || "").trim();
    const industry = String(req.query.industry || "").trim();
    const location = String(req.query.location || "").trim();
    const search = String(req.query.search || "").trim();
    const whereClauses: string[] = [];
    const replacements: any = {};

    if (isCompanyUser) {
      if (!requesterDbId) {
        return sendErrorResponse(res, 400, "company_id must be provided for company users");
      }
      whereClauses.push("company_id = :companyId");
      replacements.companyId = requesterDbId;
      if (status) {
        whereClauses.push("status ILIKE :status");
        replacements.status = status;
      }
    } else if (isAdminUser) {
      // Admin users can view all manpower requirements without a status barrier.
    } else if (isContractorUser) {
      whereClauses.push("status ILIKE 'approved'");
    } else {
      whereClauses.push("status ILIKE 'approved'");
    }
    if (industry) {
      whereClauses.push("industry_categories::text ILIKE :industry");
      replacements.industry = `%${industry}%`;
    }
    if (location) {
      whereClauses.push("requirement_details::text ILIKE :location");
      replacements.location = `%${location}%`;
    }
    if (search) {
      whereClauses.push(`(
        requirement_id ILIKE :search
        OR company_details::text ILIKE :search
        OR requirement_details::text ILIKE :search
      )`);
      replacements.search = `%${search}%`;
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const requirements = await sequelize.query(
      `
        SELECT
          ${pkColumn} AS id,
          requirement_id,
          company_id,
          status,
          company_details,
          requirement_details,
          manpower_rows,
          industry_categories,
          preferred_industry_experience,
          contractor_scope,
          commercial_terms,
          supporting_pdf_path,
          additional_notes,
          created_at,
          updated_at
        FROM public.manpower_requirements
        ${whereSql}
        ORDER BY created_at DESC
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      },
    );
    const bidCounts = await getManpowerBidCounts(
      requirements.map((requirement: any) => requirement.id),
    );

    const data = await Promise.all(
      requirements.map(async (requirement: any) => {
        const serialized = await serializeRequirementForUser(
          { toJSON: () => requirement },
          role,
          requesterId,
        );
        return {
          ...serialized,
          bid_count: bidCounts.get(String(requirement.id)) || 0,
        };
      }),
    );

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (err: any) {
    console.error("Get manpower requirements error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower requirements", err);
  }
};

export const getManpowerRequirementById = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const requirement = await findRequirementByIdentifier(req.params.id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    const body = getParsedBody(req);
    const userId = getUserId(req, body, [
      "contractor_id",
      "contractorId",
      "company_id",
      "companyId",
      "login_id",
      "loginId",
      "user_id",
      "userId",
    ]);
    const role = getRole(req, body);
    const userDbId = normalizeUserReference(userId);
    const data: any = await serializeRequirementForUser(requirement, role, userId);
    const bidCounts = await getManpowerBidCounts([requirement.id]);
    const isOwnerCompany = Boolean(userDbId) && String(requirement.company_id) === userDbId;

    data.bid_count = bidCounts.get(String(requirement.id)) || 0;

    if (isOwnerCompany) {
      data.bids = await getRequirementBidsWithContractorCompany(requirement.id);
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Get manpower requirement detail error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower requirement", err);
  }
};

export const deleteManpowerRequirement = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const rawCompanyId = getUserId(
      req,
      { ...body, ...req.query },
      ["company_id", "companyId", "login_id", "loginId"],
    );
    const companyDbId = validateUserReference(res, rawCompanyId, "company_id");
    if (!companyDbId) return;

    const requirement = await findRequirementByIdentifier(req.params.id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    if (String(requirement.company_id) !== companyDbId) {
      return sendErrorResponse(
        res,
        403,
        "Only the owner company can delete this manpower requirement",
      );
    }

    await requirement.destroy();

    return res.status(200).json({
      success: true,
      message: "Manpower requirement deleted successfully",
      data: {
        id: requirement.id,
        requirement_id: requirement.requirement_id,
      },
    });
  } catch (err: any) {
    console.error("Delete manpower requirement error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete manpower requirement", err);
  }
};

export const createManpowerBid = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const requirement = await findRequirementByIdentifier(req.params.id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    const body = getParsedBody(req);
    const contractorId = getUserId(req, body, ["contractor_id", "contractorId", "login_id", "loginId"]);
    const role = getRole(req, body);
    const contractorDbId = validateUserReference(res, contractorId, "contractor_id");
    if (!contractorDbId) return;
    if (role && !isContractorRole(role)) {
      return sendErrorResponse(res, 403, "Only contractor users can submit manpower bids");
    }

    const existingBid = await findExistingManpowerBidRow(requirement.id, contractorDbId);
    if (existingBid) {
      return sendErrorResponse(res, 409, "Bid already submitted for this requirement");
    }

    const marginCharges = safeParseJson(body.margin_charges ?? body.marginCharges, {});
    const { commercialQuotation, commercialSummary } = calculateBid(
      safeParseJson(body.commercial_quotation ?? body.commercialQuotation, []),
      marginCharges,
    );
    const documents: any = safeParseJson(body.documents, {});
    const declaration: any = safeParseJson(body.declaration, {});

    applyBidFileUploads(req, documents, declaration);

    const bid = await insertManpowerBidRow({
      manpowerRequirementId: requirement.id,
      contractorId: contractorDbId,
      status: body.status || "submitted",
      commercialQuotation,
      marginCharges,
      commercialSummary,
      contractorCapability: safeParseJson(body.contractor_capability ?? body.contractorCapability, {}),
      documents,
      declaration,
    });

    return res.status(201).json({
      success: true,
      message: "Manpower bid submitted successfully",
      data: withBidId(bid),
    });
  } catch (err: any) {
    console.error("Create manpower bid error:", err.message);
    return sendErrorResponse(res, 500, "Failed to submit manpower bid", err);
  }
};

export const getMyManpowerBid = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const contractorId = getUserId(req, body, ["contractor_id", "contractorId", "login_id", "loginId"]);
    const contractorDbId = validateUserReference(res, contractorId, "contractor_id");
    if (!contractorDbId) return;

    const requirement = await findRequirementByIdentifier(req.params.id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    const bid = await findExistingManpowerBidRow(requirement.id, contractorDbId);

    return res.status(200).json({ success: true, data: bid || null });
  } catch (err: any) {
    console.error("Get my manpower bid error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower bid", err);
  }
};

export const getManpowerBids = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const role = await resolveRequestRole(req, { ...body, ...req.query });
    const isAdminUser = isAdminRole(role);
    const isCompanyUser = isCompanyRole(role);
    const isContractorUser = isContractorRole(role);
    const requestBody = { ...body, ...req.query };
    const rawContractorId = getUserId(req, requestBody, ["contractor_id", "contractorId", "login_id", "loginId"]);
    const rawCompanyId = getUserId(req, requestBody, ["company_id", "companyId", "login_id", "loginId"]);
    const contractorDbId = rawContractorId && isContractorUser
      ? validateUserReference(res, rawContractorId, "contractor_id")
      : null;
    const companyDbId = rawCompanyId && isCompanyUser
      ? validateUserReference(res, rawCompanyId, "company_id")
      : null;

    if (rawContractorId && isContractorUser && !contractorDbId) return;
    if (rawCompanyId && isCompanyUser && !companyDbId) return;

    const rows = await sequelize.query(
      `
        SELECT
          mb.*,
          mr.requirement_id,
          mr.company_id,
          mr.status AS requirement_status,
          mr.company_details,
          mr.requirement_details,
          mr.manpower_rows,
          mr.industry_categories,
          mr.commercial_terms,
          mr.created_at AS requirement_created_at
        FROM public.manpower_bids mb
        JOIN public.manpower_requirements mr
          ON mr.id = mb.manpower_requirement_id
        WHERE (
          :isAdmin = TRUE
          OR (:isCompany = TRUE AND mr.company_id = :companyId::uuid)
          OR (:isContractor = TRUE AND mb.contractor_id = :contractorId::uuid)
        )
        ORDER BY mb.created_at DESC
      `,
      {
        replacements: {
          contractorId: contractorDbId,
          companyId: companyDbId,
          isAdmin: isAdminUser,
          isCompany: isCompanyUser,
          isContractor: isContractorUser,
        },
        type: QueryTypes.SELECT,
      },
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err: any) {
    console.error("Get manpower bids error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower bids", err);
  }
};

export const getManpowerBidById = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const role = await resolveRequestRole(req, { ...body, ...req.query });
    const isAdminUser = isAdminRole(role);
    const isCompanyUser = isCompanyRole(role);
    const isContractorUser = isContractorRole(role);
    const requestBody = { ...body, ...req.query };
    const rawContractorId = getUserId(req, requestBody, ["contractor_id", "contractorId", "login_id", "loginId"]);
    const rawCompanyId = getUserId(req, requestBody, ["company_id", "companyId", "login_id", "loginId"]);
    const contractorDbId = rawContractorId && isContractorUser
      ? validateUserReference(res, rawContractorId, "contractor_id")
      : null;
    const companyDbId = rawCompanyId && isCompanyUser
      ? validateUserReference(res, rawCompanyId, "company_id")
      : null;

    if (rawContractorId && isContractorUser && !contractorDbId) return;
    if (rawCompanyId && isCompanyUser && !companyDbId) return;

    const rows = await sequelize.query(
      `
        SELECT
          mb.*,
          mr.requirement_id,
          mr.company_id,
          mr.status AS requirement_status,
          mr.company_details,
          mr.requirement_details,
          mr.manpower_rows,
          mr.industry_categories,
          mr.preferred_industry_experience,
          mr.contractor_scope,
          mr.commercial_terms,
          mr.supporting_pdf_path,
          mr.additional_notes,
          mr.created_at AS requirement_created_at,
          mr.updated_at AS requirement_updated_at
        FROM public.manpower_bids mb
        JOIN public.manpower_requirements mr
          ON mr.id = mb.manpower_requirement_id
        WHERE mb.bid_id = :bidId::uuid
          AND (
            :isAdmin = TRUE
            OR (:isCompany = TRUE AND mr.company_id = :companyId::uuid)
            OR (:isContractor = TRUE AND mb.contractor_id = :contractorId::uuid)
          )
        LIMIT 1
      `,
      {
        replacements: {
          bidId: req.params.bidId,
          contractorId: contractorDbId,
          companyId: companyDbId,
          isAdmin: isAdminUser,
          isCompany: isCompanyUser,
          isContractor: isContractorUser,
        },
        type: QueryTypes.SELECT,
      },
    );

    if (!rows.length) {
      return sendErrorResponse(res, 404, "Manpower bid not found");
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err: any) {
    console.error("Get manpower bid detail error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower bid detail", err);
  }
};

export const deleteManpowerBid = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const rawContractorId = getUserId(
      req,
      { ...body, ...req.query },
      ["contractor_id", "contractorId", "login_id", "loginId"],
    );
    const contractorDbId = validateUserReference(res, rawContractorId, "contractor_id");
    if (!contractorDbId) return;

    const rows = await sequelize.query(
      `
        DELETE FROM public.manpower_bids
        WHERE bid_id = :bidId::uuid
          AND contractor_id = :contractorId::uuid
        RETURNING *
      `,
      {
        replacements: {
          bidId: req.params.bidId,
          contractorId: contractorDbId,
        },
        type: QueryTypes.SELECT,
      },
    );

    if (!rows.length) {
      return sendErrorResponse(
        res,
        404,
        "Manpower bid not found or you do not have permission to delete it",
      );
    }

    return res.status(200).json({
      success: true,
      message: "Manpower bid deleted successfully",
      data: rows[0],
    });
  } catch (err: any) {
    console.error("Delete manpower bid error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete manpower bid", err);
  }
};

export const updateManpowerBid = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const bid = await ManpowerBid.findByPk(req.params.bidId);
    if (!bid) {
      return sendErrorResponse(res, 404, "Manpower bid not found");
    }

    const body = getParsedBody(req);
    const contractorId = getUserId(req, body, ["contractor_id", "contractorId", "login_id", "loginId"]);
    const contractorDbId = validateUserReference(res, contractorId, "contractor_id");
    if (!contractorDbId) return;
    if (String(bid.contractor_id) !== contractorDbId) {
      return sendErrorResponse(res, 403, "You can update only your own bid");
    }

    const requirement = await ManpowerRequirement.findByPk(bid.manpower_requirement_id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }
    if (isBidClosed(requirement)) {
      return sendErrorResponse(res, 400, "Bid closing time has passed");
    }

    const marginCharges = safeParseJson(
      body.margin_charges ?? body.marginCharges,
      bid.margin_charges || {},
    );
    const { commercialQuotation, commercialSummary } = calculateBid(
      safeParseJson(
        body.commercial_quotation ?? body.commercialQuotation,
        bid.commercial_quotation || [],
      ),
      marginCharges,
    );
    const documents: any = safeParseJson(body.documents, bid.documents || {});
    const declaration: any = safeParseJson(body.declaration, bid.declaration || {});

    applyBidFileUploads(req, documents, declaration);

    await bid.update({
      status: body.status || bid.status,
      commercial_quotation: commercialQuotation,
      margin_charges: marginCharges,
      commercial_summary: commercialSummary,
      contractor_capability: safeParseJson(
        body.contractor_capability ?? body.contractorCapability,
        bid.contractor_capability || {},
      ),
      documents,
      declaration,
    });

    return res.status(200).json({
      success: true,
      message: "Manpower bid updated successfully",
      data: bid.toJSON(),
    });
  } catch (err: any) {
    console.error("Update manpower bid error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update manpower bid", err);
  }
};

export const getManpowerLiveBids = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const requirements = await ManpowerRequirement.findAll({
      order: [["created_at", "DESC"]],
    });

    const activeRequirements = requirements.filter((requirement: any) => {
      const terms = requirement.commercial_terms || {};
      const start = parseBidWindowDate(terms.online_bid_date, terms.online_bid_start_time);
      const end = parseBidWindowDate(
        terms.online_bid_date || terms.tender_closing_date,
        terms.online_bid_end_time || "23:59",
      );
      const now = Date.now();
      if (start && start.getTime() > now) return false;
      if (end && end.getTime() < now) return false;
      return true;
    });

    return res.status(200).json({
      success: true,
      count: activeRequirements.length,
      data: activeRequirements.map((requirement) => requirement.toJSON()),
    });
  } catch (err: any) {
    console.error("Get manpower live bids error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower live bids", err);
  }
};

export const getManpowerLiveBidByRequirement = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const requirement = await findRequirementByIdentifier(req.params.requirementId);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    const body = { ...getParsedBody(req), ...req.query };
    const userId = getUserId(req, body, ["contractor_id", "contractorId", "company_id", "companyId", "login_id", "loginId"]);
    const userDbId = normalizeUserReference(userId);
    const role = await resolveRequestRole(req, body);
    const bids = await sequelize.query(
      `
        SELECT *
        FROM public.manpower_bids
        WHERE manpower_requirement_id = :manpowerRequirementId
        ORDER BY created_at ASC
      `,
      {
        replacements: {
          manpowerRequirementId: requirement.id,
        },
        type: QueryTypes.SELECT,
      },
    );
    const canViewAllBids = isAdminRole(role) || isCompanyRole(role);

    const rankedBids = bids
      .map((bid: any) => ({
        ...bid,
        final_monthly_quotation: toNumber(bid.commercial_summary?.final_monthly_quotation),
      }))
      .sort((a, b) => a.final_monthly_quotation - b.final_monthly_quotation)
      .map((bid, index) => {
        const isOwnBid = Boolean(userDbId) && String(bid.contractor_id) === userDbId;
        const isApprovedBid = String(bid.status || "").trim().toLowerCase() === "approved";
        if (canViewAllBids || isOwnBid || isApprovedBid) {
          return {
            ...bid,
            live_bid_rank: index + 1,
            live_bid_label: `L${index + 1}`,
          };
        }

        return {
          id: bid.bid_id,
          bid_id: bid.bid_id,
          manpower_requirement_id: bid.manpower_requirement_id,
          contractor_id: bid.contractor_id,
          status: bid.status,
          live_bid_rank: index + 1,
          live_bid_label: `L${index + 1}`,
          commercial_summary: {
            final_monthly_quotation: null,
            yearly_cost: null,
          },
          commercial_quotation: (bid.commercial_quotation || []).map((row: any) => ({
            position: row.position,
            category: row.category,
            qty: row.qty,
            contractor_rate_monthly: null,
            service_charge_percent: null,
            service_charge_amount: null,
            total_amount: null,
          })),
        };
      });
    const visibleRankedBids =
      isContractorRole(role)
        ? rankedBids.filter((bid: any) => {
            const isOwnBid = Boolean(userDbId) && String(bid.contractor_id) === userDbId;
            const isApprovedBid = String(bid.status || "").trim().toLowerCase() === "approved";
            return isOwnBid || isApprovedBid;
          })
        : rankedBids;

    return res.status(200).json({
      success: true,
      data: {
        requirement: await serializeRequirementForUser(requirement, role, userId),
        bid_ladder: visibleRankedBids,
      },
    });
  } catch (err: any) {
    console.error("Get manpower live bid detail error:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch manpower live bid detail", err);
  }
};

export const updateManpowerRequirementStatus = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const role = await resolveRequestRole(req, body);
    if (!isAdminRole(role)) {
      return sendErrorResponse(res, 403, "Only admin users can update manpower requirement status");
    }

    const requirementId = body.requirement_id ?? body.requirementId ?? body.id;
    const status = String(body.status || "").trim().toLowerCase();
    if (!requirementId || !status) {
      return sendErrorResponse(res, 400, "requirement_id and status are required");
    }

    const requirement = await findRequirementByIdentifier(String(requirementId));
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    await requirement.update({ status });

    return res.status(200).json({
      success: true,
      message: "Manpower requirement status updated successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Update manpower requirement status error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update manpower requirement status", err);
  }
};

export const updateManpowerBidStatus = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const body = getParsedBody(req);
    const role = await resolveRequestRole(req, body);
    if (!isAdminRole(role)) {
      return sendErrorResponse(res, 403, "Only admin users can update manpower bid status");
    }

    const bidId = body.bid_id ?? body.bidId ?? body.id;
    const status = String(body.status || "").trim().toLowerCase();
    if (!bidId || !status) {
      return sendErrorResponse(res, 400, "bid_id and status are required");
    }

    const bid = await ManpowerBid.findByPk(String(bidId));
    if (!bid) {
      return sendErrorResponse(res, 404, "Manpower bid not found");
    }

    await bid.update({ status });

    return res.status(200).json({
      success: true,
      message: "Manpower bid status updated successfully",
      data: bid.toJSON(),
    });
  } catch (err: any) {
    console.error("Update manpower bid status error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update manpower bid status", err);
  }
};

export const awardManpowerBid = async (req: Request, res: Response) => {
  try {
    await ensureManpowerTables();
    const requirement = await findRequirementByIdentifier(req.params.id);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Manpower requirement not found");
    }

    const bid = await ManpowerBid.findOne({
      where: { bid_id: req.params.bidId, manpower_requirement_id: requirement.id },
    });
    if (!bid) {
      return sendErrorResponse(res, 404, "Manpower bid not found");
    }

    const body = getParsedBody(req);
    const companyId = getUserId(req, body, ["company_id", "companyId", "login_id", "loginId"]);
    const companyDbId = validateUserReference(res, companyId, "company_id");
    if (!companyDbId) return;
    if (String(requirement.company_id) !== companyDbId) {
      return sendErrorResponse(res, 403, "Only the requirement owner can award this bid");
    }

    const award = await ManpowerBidAward.create({
      manpower_requirement_id: requirement.id,
      manpower_bid_id: bid.bid_id,
      contractor_id: bid.contractor_id,
      awarded_by: companyDbId,
      status: "awarded",
    });

    await requirement.update({ status: "awarded" });
    await bid.update({ status: "awarded" });

    return res.status(201).json({
      success: true,
      message: "Manpower bid awarded successfully",
      data: award.toJSON(),
    });
  } catch (err: any) {
    console.error("Award manpower bid error:", err.message);
    return sendErrorResponse(res, 500, "Failed to award manpower bid", err);
  }
};
