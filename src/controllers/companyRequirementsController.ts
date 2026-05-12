import { Request, Response } from "express";
import { protect } from "../middleware/authMiddleware";
import { CompanyRequirements, Bid, User, Payment } from "../models";
import { sendErrorResponse } from "../utils/errorResponse";
import { Op } from "sequelize";
import sequelize from "../config/data-source";
import fs from "fs";
import path from "path";

const getBidTotalAmount = (bidDetails: any): number => {
  const parseAmount = (value: any): number => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.\-]/g, "").trim();
      if (!cleaned) return 0;
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const amountKeys = [
    "total_amount",
    "totalAmount",
    "total",
    "bid_amount",
    "bidAmount",
    "bid_total",
    "bidTotal",
    "amount",
    "totalPrice",
    "grand_total",
    "grandTotal",
    "price",
    "value",
  ];

  const lineArrayKeys = ["items", "line_items", "lineItems", "charges", "rates", "details"];

  const searchValue = (value: any): number => {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === "number" || typeof value === "string") {
      return parseAmount(value);
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + searchValue(item), 0);
    }

    if (typeof value === "object") {
      for (const key of amountKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          const amount = parseAmount((value as any)[key]);
          if (amount !== 0) {
            return amount;
          }
        }
      }

      for (const key of lineArrayKeys) {
        const items = (value as any)[key];
        if (Array.isArray(items)) {
          return items.reduce((sum: number, item: any) => sum + searchValue(item), 0);
        }
      }

      for (const key of Object.keys(value)) {
        const nested = searchValue((value as any)[key]);
        if (nested !== 0) {
          return nested;
        }
      }
    }

    return 0;
  };

  return searchValue(bidDetails);
};

// Create a new company requirement
const safeParseJson = <T = any>(value: any): T => {
  if (value === undefined || value === null || value === "undefined" || value === "null") {
    return {} as T;
  }

  if (typeof value === "object") {
    return value as T;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {} as T;
  }
};

export const createRequirement = async (req: Request, res: Response) => {
  try {
    // ✅ parse full JSON from "data"
    const parsedBody = req.body.data ? JSON.parse(req.body.data) : req.body;

    const {
      warehouse_location,
      warehouse_size,
      warehouse_compliance,
      material_details,
      labour_details,
      office_expenses,
      company_id,
      transport,
      requirement_type,
      bid_details,
      distance,
      status,
      description,
      miscellaneous,
    } = parsedBody;

    if (!company_id) {
      return sendErrorResponse(res, 400, "company_id is required");
    }

    if (!requirement_type) {
      return sendErrorResponse(res, 400, "requirement_type is required");
    }

    const requirement = await CompanyRequirements.create({
      warehouse_location: warehouse_location || {},
      company_id: Number(company_id),
      warehouse_size: warehouse_size || {},
      warehouse_compliance: warehouse_compliance || {},
      material_details: material_details || {},
      labour_details: labour_details || {},
      office_expenses: office_expenses || {},
      transport: transport || [],
      requirement_type,
      bid_details: bid_details || {},
      distance: distance || [],
      status: status || "submitted",
      description: description || "",
      miscellaneous:
        miscellaneous && Object.keys(miscellaneous).length
          ? miscellaneous
          : { field1: "", field2: "", field3: "" },
      pdf_file: null,
    });

    // ✅ FILE HANDLING
    const pdfFile = (req.file as Express.Multer.File | undefined) || null;

    if (pdfFile) {
      const requirementPdfDir = path.join(
        "uploads",
        "pdf",
        `requirement_${requirement.id}`
      );

      if (!fs.existsSync(requirementPdfDir)) {
        fs.mkdirSync(requirementPdfDir, { recursive: true });
      }

      const currentPath = path.join("uploads", "pdf", pdfFile.filename);
      const destinationPath = path.join(requirementPdfDir, pdfFile.filename);

      fs.renameSync(currentPath, destinationPath);

      const pdfMeta = {
        filename: pdfFile.filename,
        mimetype: pdfFile.mimetype,
        size: pdfFile.size,
        url: `/uploads/pdf/requirement_${requirement.id}/${pdfFile.filename}`,
      };

      await requirement.update({ pdf_file: pdfMeta });
    }

    res.status(201).json({
      success: true,
      message: "Requirement created successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Create Requirement Error:", err.message);
    return sendErrorResponse(res, 500, "Failed to create requirement", err);
  }
};

export const updateCompanyRequirements = async (req: Request, res: Response) => {
  try {
    // ✅ parse full JSON from "data"
    const parsedBody = req.body.data
      ? { ...req.body, ...safeParseJson(req.body.data) }
      : req.body;

    const {
      id: bodyId,
      requirement_id,
      requirementId,
      warehouse_location,
      warehouse_size,
      warehouse_compliance,
      material_details,
      labour_details,
      office_expenses,
      company_id: bodyCompanyId,
      companyId,
      login_id,
      loginId,
      transport,
      requirement_type,
      bid_details,
      distance,
      status,
      description,
      miscellaneous,
    } = parsedBody;

    const id = bodyId ?? requirement_id ?? requirementId;
    const company_id = bodyCompanyId ?? companyId ?? login_id ?? loginId;

    if (!id || !company_id) {
      return sendErrorResponse(res, 400, "id and company_id are required");
    }

    const requirement = await CompanyRequirements.findOne({
      where: { id: Number(id), company_id: Number(company_id) },
    });

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    const pdfFile = (req.file as Express.Multer.File | undefined) || null;

    const getUpdatedValue = (value: any, currentValue: any, defaultValue: any) =>
      value !== undefined ? value || defaultValue : currentValue ?? defaultValue;

    const updatePayload: any = {
      warehouse_location: getUpdatedValue(
        warehouse_location,
        requirement.warehouse_location,
        {}
      ),
      warehouse_size: getUpdatedValue(warehouse_size, requirement.warehouse_size, {}),
      warehouse_compliance: getUpdatedValue(
        warehouse_compliance,
        requirement.warehouse_compliance,
        {}
      ),
      material_details: getUpdatedValue(
        material_details,
        requirement.material_details,
        {}
      ),
      labour_details: getUpdatedValue(labour_details, requirement.labour_details, {}),
      office_expenses: getUpdatedValue(
        office_expenses,
        requirement.office_expenses,
        {}
      ),
      transport: getUpdatedValue(transport, requirement.transport, []),
      requirement_type: getUpdatedValue(
        requirement_type,
        requirement.requirement_type,
        ""
      ),
      bid_details: getUpdatedValue(bid_details, requirement.bid_details, {}),
      distance: getUpdatedValue(distance, requirement.distance, []),
      status: getUpdatedValue(status, requirement.status, "submitted"),
      description:
        description !== undefined
          ? String(description || "")
          : requirement.description || "",
      miscellaneous:
        miscellaneous !== undefined
          ? miscellaneous && Object.keys(miscellaneous).length
            ? miscellaneous
            : { field1: "", field2: "", field3: "" }
          : requirement.miscellaneous || { field1: "", field2: "", field3: "" },
    };

    // ✅ FILE UPDATE
    if (pdfFile) {
      const requirementPdfDir = path.join(
        "uploads",
        "pdf",
        `requirement_${requirement.id}`
      );

      if (!fs.existsSync(requirementPdfDir)) {
        fs.mkdirSync(requirementPdfDir, { recursive: true });
      }

      const currentPath = path.join("uploads", "pdf", pdfFile.filename);
      const destinationPath = path.join(requirementPdfDir, pdfFile.filename);

      fs.renameSync(currentPath, destinationPath);

      updatePayload.pdf_file = {
        filename: pdfFile.filename,
        mimetype: pdfFile.mimetype,
        size: pdfFile.size,
        url: `/uploads/pdf/requirement_${requirement.id}/${pdfFile.filename}`,
      };
    }

    await requirement.update(updatePayload);

    res.status(200).json({
      success: true,
      message: "Requirement updated successfully",
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Update error:", err.message);
    return sendErrorResponse(res, 500, "Failed to update requirement", err);
  }
};

export const getCurrRequirment = async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    return sendErrorResponse(res, 400, "ID is required");
  }

  try {
    const companyIdParsed = parseInt(id, 10);

    if (isNaN(companyIdParsed)) {
      return sendErrorResponse(res, 400, "ID must be a valid number");
    }

    const requirement = await CompanyRequirements.findByPk(companyIdParsed);

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    res.status(200).json({
      success: true,
      data: requirement.toJSON(),
    });
  } catch (err: any) {
    console.error("Error fetching company requirements:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirement", err);
  }
};

export const getCompanyList = async (req: Request, res: Response) => {
  try {
    const login_id = req.user?.login_id || req.user?.id;
    const numericLoginId = login_id ? Number(login_id) : null;
    if (!numericLoginId) {
      return sendErrorResponse(res, 401, "User not authenticated");
    }

    // Fetch requirements where status is approved or company_id matches
    const requirements = await CompanyRequirements.findAll({
      where: {
        [Op.or]: [
          { status: "approved" },
          { company_id: numericLoginId },
        ],
      },
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Map and deduplicate
    const uniqueCompanies = new Map<string, string>();
    requirements.forEach((req: any) => {
      const company = req.bid_details || {};
      const key = `${req.company_id}`;
      if (!uniqueCompanies.has(key)) {
        uniqueCompanies.set(key, company.company_name || null);
      }
    });

    const data = Array.from(uniqueCompanies.entries()).map(([id, name]) => ({
      company_id: parseInt(id),
      company_name: name,
    }));

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Error fetching company data:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch companies", err);
  }
};


export const getRequirementDetails = async (req: Request, res: Response) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return sendErrorResponse(res, 405, `Method ${req.method} not allowed`);
  }

  const { id, company_id, login_id, user_id, role } = req.body;
  if (!id || !company_id) {
    return sendErrorResponse(res, 400, "id and company_id are required");
  }

  const requirementId = parseInt(id, 10);
  const companyId = parseInt(company_id, 10);
  if (isNaN(requirementId) || isNaN(companyId)) {
    return sendErrorResponse(res, 400, "id and company_id must be numeric");
  }

  try {
    const requesterUserIdCandidates = [
      login_id,
      user_id,
      req.user?.id,
      req.user?.login_id,
      req.user?.userId,
      companyId,
    ]
      .map((value) => Number(value))
      .filter((value, index, arr) => Number.isFinite(value) && value > 0 && arr.indexOf(value) === index);

    const requesterUserId = requesterUserIdCandidates[0] || NaN;

    let roleValue = String(role || req.user?.role || "").toLowerCase();
    if (!roleValue && requesterUserId && !isNaN(requesterUserId)) {
      const requesterUser = await User.findByPk(requesterUserId);
      roleValue = String(requesterUser?.role || "").toLowerCase();
    }
    const isThreePlRole = ["threepl", "3pl", "three_pl"].includes(roleValue);

    if (isThreePlRole) {
      if (requesterUserIdCandidates.length === 0) {
        return res.status(200).json({
          success: false,
          message: "Payment not done",
        });
      }

      const payments = await Payment.findAll({
        where: {
          user_id: { [Op.in]: requesterUserIdCandidates },
        },
        order: [["updated_at", "DESC"], ["created_at", "DESC"]],
      });

      if (!payments.length) {
        return res.status(200).json({
          success: false,
          message: "Payment not done",
        });
      }

      const hasSuccessfulPayment = payments.some((payment: any) => {
        const paymentStatus = String(payment?.status || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "");
        const isPaymentFailed = /(fail|error|cancel|declin|denied|reject|void|timeout|expire)/.test(
          paymentStatus
        );
        return !isPaymentFailed && /(success|successful|paid|captur|complete|succeed)/.test(paymentStatus);
      });

      if (!hasSuccessfulPayment) {
        return res.status(200).json({
          success: false,
          message: "Payment not done",
        });
      }
    }

    // Fetch the requirement
    let requirement;
    if (isThreePlRole) {
      requirement = await CompanyRequirements.findByPk(requirementId);
    } else {
      requirement = await CompanyRequirements.findOne({
        where: { id: requirementId, company_id: companyId },
      });
    }

    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    // Fetch related bids and sort by total bid amount low-to-high
    const bids = await Bid.findAll({
      where: { requirement_id: requirementId },
    });

    const sortedBids = bids
      .slice()
      .sort((a: any, b: any) => {
        const aAmount = getBidTotalAmount(a.bid_details || {});
        const bAmount = getBidTotalAmount(b.bid_details || {});
        if (aAmount !== bAmount) {
          return aAmount - bAmount;
        }
        return Number(a.id) - Number(b.id);
      });

    const filteredBids = sortedBids.map((bid: any) => {
      const bidJson = bid.toJSON();
      if (isThreePlRole && requesterUserId) {
        if (Number(bidJson.pl_details?.id) === requesterUserId) {
          return bidJson;
        }
        return {
          ...bidJson,
          bid_details: {},
        };
      }
      return bidJson;
    });

    return res.status(200).json({
      success: true,
      data: {
        ...requirement.toJSON(),
        bids: filteredBids,
      },
    });
  } catch (err: any) {
    console.error("Error fetching requirement details:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirement details", err);
  }
};

export const deleteCompanyRequirements = async (req: Request, res: Response) => {
  const { company_id, requirement_id } = req.body;
  if (!requirement_id || !company_id) {
    return sendErrorResponse(res, 400, "requirement_id and company_id are required");
  }

  try {
    const requirementIdParsed = parseInt(requirement_id, 10);
    const loginIdParsed = parseInt(company_id, 10);

    if (isNaN(requirementIdParsed) || isNaN(loginIdParsed)) {
      return sendErrorResponse(res, 400, "IDs must be valid numbers");
    }

    // Fetch user and check role
    const user = await User.findByPk(loginIdParsed);
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const isAdmin = user.role === "admin";

    // Fetch requirement
    const requirement = await CompanyRequirements.findByPk(requirementIdParsed);
    if (!requirement) {
      return sendErrorResponse(res, 404, "Requirement not found");
    }

    // Check permissions for normal users
    if (!isAdmin) {
      if (Number(requirement.company_id) !== loginIdParsed) {
        return sendErrorResponse(res, 403, "You do not have permission to delete this requirement");
      }

      if (requirement.status !== "submitted") {
        return sendErrorResponse(res, 400, "Only submitted requirements can be deleted");
      }
    }

    // Delete
    await requirement.destroy();

    return res.status(200).json({
      success: true,
      message: "Requirement deleted successfully",
    });
  } catch (err: any) {
    console.error("Delete requirement error:", err.message);
    return sendErrorResponse(res, 500, "Failed to delete requirement", err);
  }
};

export const getLocationListLocationsByUser = async (
  req: Request,
  res: Response,
) => {
  const { login_id } = req.params;

  if (!login_id || isNaN(Number(login_id))) {
    return sendErrorResponse(res, 400, "login_id is required and must be numeric");
  }

  const companyId = Number(login_id);

  try {
    const requirements = await CompanyRequirements.findAll({
      where: { company_id: companyId },
      attributes: ["warehouse_location"],
      raw: true,
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, locations: [] });
    }

    // Extract unique display names
    const locationSet = new Set<string>();
    requirements.forEach((req: any) => {
      if (req.warehouse_location?.display_name) {
        locationSet.add(req.warehouse_location.display_name);
      }
    });

    const locations = Array.from(locationSet).sort();

    return res.status(200).json({
      success: true,
      company_id: companyId,
      locations,
    });
  } catch (err: any) {
    console.error("Error fetching warehouse locations:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch locations", err);
  }
};

export const liveBids = async (req: Request, res: Response) => {
  try {
    const login_id = req.params.login_id ? Number(req.params.login_id) : null;
    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    // Get user role
    const user = await User.findByPk(login_id);
    if (!user) {
      return sendErrorResponse(res, 404, "User not found");
    }

    const { role } = user;
    const normalizedRole = String(role || "").toLowerCase();
    const isThreePlRole = ["threepl", "3pl", "three_pl"].includes(normalizedRole);

    // Fetch requirements
    let requirementsWhere: any = {};
    if (normalizedRole === "company") {
      requirementsWhere.company_id = login_id;
    }

    const requirements = await CompanyRequirements.findAll({
      where: requirementsWhere,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const timeZone = process.env.LIVE_BIDS_TIMEZONE || "Asia/Kolkata";

    const getTimeZoneOffsetMs = (date: Date): number => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(date).reduce(
        (acc: Record<string, string>, part) => {
          if (part.type !== "literal") {
            acc[part.type] = part.value;
          }
          return acc;
        },
        {},
      );

      return (
        Date.UTC(
          Number(parts.year),
          Number(parts.month) - 1,
          Number(parts.day),
          Number(parts.hour),
          Number(parts.minute),
          Number(parts.second),
        ) - date.getTime()
      );
    };

    const toUtcFromLocal = (
      year: number,
      month: number,
      day: number,
      hour = 0,
      minute = 0,
    ) => {
      const localMs = Date.UTC(year, month - 1, day, hour, minute, 0);
      const offsetMs = getTimeZoneOffsetMs(new Date(localMs));
      return new Date(localMs - offsetMs);
    };

    const now = new Date();
    const localNowParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .reduce((acc: Record<string, string>, part) => {
        if (part.type !== "literal") {
          acc[part.type] = part.value;
        }
        return acc;
      }, {});

    const todayStart = toUtcFromLocal(
      Number(localNowParts.year),
      Number(localNowParts.month),
      Number(localNowParts.day),
      0,
      0,
    );
    const tomorrowStart = toUtcFromLocal(
      Number(localNowParts.year),
      Number(localNowParts.month),
      Number(localNowParts.day) + 1,
      0,
      0,
    );

    const parseBidDateTime = (rawDate: any, rawTime: any): Date | null => {
      if (!rawDate) {
        return null;
      }

      const datePart = String(rawDate).trim();
      const baseDate = new Date(`${datePart}T00:00:00`);
      if (isNaN(baseDate.getTime())) {
        return null;
      }

      const year = baseDate.getFullYear();
      const month = baseDate.getMonth() + 1;
      const day = baseDate.getDate();
      let hour = 0;
      let minute = 0;

      if (rawTime) {
        const rawTimeText = String(rawTime).trim();
        let timeText = rawTimeText.toUpperCase();
        const isMeridianTime = /(AM|PM)$/.test(timeText);

        if (isMeridianTime) {
          const meridian = timeText.endsWith("PM") ? "PM" : "AM";
          timeText = timeText.replace(/\s*(AM|PM)\s*$/, "");
          const [hourStr, minuteStr = "0"] = timeText.split(":");
          hour = Number(hourStr);
          minute = Number(minuteStr);

          if (Number.isNaN(hour) || Number.isNaN(minute)) {
            return null;
          }

          if (meridian === "PM" && hour < 12) hour += 12;
          if (meridian === "AM" && hour === 12) hour = 0;
        } else {
          const [hourStr, minuteStr = "0"] = timeText.split(":");
          hour = Number(hourStr);
          minute = Number(minuteStr);
          if (Number.isNaN(hour) || Number.isNaN(minute)) {
            return null;
          }
        }
      }

      return toUtcFromLocal(year, month, day, hour, minute);
    };

    const parseBidProcessDateTime = (bidDetails: any): Date | null => {
      return parseBidDateTime(
        bidDetails?.bid_process_date ?? bidDetails?.bidProcessDate,
        bidDetails?.bid_process_time ?? bidDetails?.bidProcessTime
      );
    };

    const parseBidProcessEndDateTime = (bidDetails: any): Date | null => {
      const rawEndTime =
        bidDetails?.bid_process_end_time ??
        bidDetails?.bidProcessEndTime;

      if (!rawEndTime) {
        return null;
      }

      return parseBidDateTime(
        bidDetails?.bid_process_end_date ??
          bidDetails?.bidProcessEndDate ??
          bidDetails?.bid_process_date ??
          bidDetails?.bidProcessDate,
        rawEndTime
      );
    };

    const todayStartedRequirements = requirements.filter((r: any) => {
      const processDateTime = parseBidProcessDateTime(r.bid_details || {});
      if (!processDateTime) {
        return false;
      }

      const processEndDateTime = parseBidProcessEndDateTime(r.bid_details || {});
      if (processEndDateTime && processEndDateTime <= now) {
        return false;
      }

      return processDateTime >= todayStart && processDateTime < tomorrowStart && processDateTime <= now;
    });

    if (todayStartedRequirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Collect requirement IDs
    const requirementIds = todayStartedRequirements.map((r: any) => r.id);

    // Fetch bids
    let bids: any[] = [];
    
    if (isThreePlRole) {
      // For 3PL, filter bids manually
      const allBids = await Bid.findAll({
        where: {
          requirement_id: { [Op.in]: requirementIds },
        },
        order: [["created_date", "DESC"]],
      });
      bids = allBids.filter((b: any) => Number(b.pl_details?.id) === login_id);
    } else {
      bids = await Bid.findAll({
        where: {
          requirement_id: { [Op.in]: requirementIds },
        },
        order: [["created_date", "DESC"]],
      });
    }

    // Attach bids to requirements
    const enrichedRequirements = todayStartedRequirements
      .map((req: any) => {
        const reqBids = bids.filter((bid: any) => bid.requirement_id === req.id);

        // For 3PL: skip this requirement if they have not placed any bid
        if (isThreePlRole && !reqBids.some((bid: any) => Number(bid.pl_details?.id) === login_id)) {
          return null;
        }

        return {
          ...req.toJSON(),
          bids: reqBids.map((b: any) => b.toJSON()),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (err: any) {
    console.error("Error fetching live bids:", err.message);
    return sendErrorResponse(res, 500, "Failed to fetch bids", err);
  }
};

export const getCompanyRequirementsList = async (req: Request, res: Response) => {
  try {
    const login_id = Number(req.body.login_id);
    const location = req.body.location; // optional

    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    let where: any = { company_id: login_id };

    if (location && location !== "null") {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push(
        sequelize.where(
          sequelize.cast(sequelize.col('warehouse_location'), 'text'),
          Op.like,
          `%"display_name": "${location}"%`
        )
      );
    }

    const requirements = await CompanyRequirements.findAll({
      where,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch bids for these requirements
    const requirementIds = requirements.map((r: any) => r.id);
    const bids = await Bid.findAll({
      where: {
        requirement_id: { [Op.in]: requirementIds },
      },
    });

    // Merge bids into requirements
    const enrichedRequirements = requirements.map((req: any) => ({
      ...req.toJSON(),
      bids: bids.filter((b: any) => b.requirement_id === req.id).map((b: any) => b.toJSON()),
    }));

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (error: any) {
    console.error("🔥 API ERROR:", error.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirements", error);
  }
};

export const threePlRequirements = async (req: Request, res: Response) => {
  try {
    const company_id = req.body.company_id ? Number(req.body.company_id) : null;
    const login_id = req.body.login_id ? Number(req.body.login_id) : null;

    if (!login_id) {
      return sendErrorResponse(res, 400, "login_id is required");
    }

    // Build requirements query
    let where: any = {};

    if (company_id) {
      where.company_id = company_id;

      // If login_id doesn't match company_id → only approved
      if (company_id !== login_id) {
        where.status = "approved";
      }
    }

    // Fetch requirements
    const requirements = await CompanyRequirements.findAll({
      where,
      order: [["created_date", "DESC"]],
    });

    if (requirements.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch bids for these requirements filtered by login_id inside pl_details JSON
    const requirementIds = requirements.map((r: any) => r.id);

    const bids = await Bid.findAll({
      where: {
        requirement_id: { [Op.in]: requirementIds },
      },
      order: [["created_date", "DESC"]],
    });

    // Filter bids where pl_details.id matches login_id
    const filteredBids = bids.filter((b: any) => b.pl_details?.id === login_id);

    // Merge bids into requirements
    const enrichedRequirements = requirements.map((req: any) => ({
      ...req.toJSON(),
      bids: filteredBids.filter((b: any) => b.requirement_id === req.id).map((b: any) => b.toJSON()),
    }));

    return res.status(200).json({ success: true, data: enrichedRequirements });
  } catch (error: any) {
    console.error("🔥 API ERROR:", error.message);
    return sendErrorResponse(res, 500, "Failed to fetch requirements", error);
  }
};
