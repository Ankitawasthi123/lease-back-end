import { Request, Response } from "express";
import { Bid, CompanyRequirements } from "../models";

export const createBid = async (req: Request, res: Response) => {
  try {
    const {
      bid_id,
      bid_details,
      bid_type,
      requirement_id,
      pl_details,
      status,
    } = req.body;

    // Validate input
    if (
      !bid_details ||
      typeof bid_details !== "object" ||
      Object.keys(bid_details).length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Missing or invalid bid_details" });
    }

    if (!bid_type || !requirement_id || !pl_details) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const bidStatus = status || "PENDING";

    let bid: any;

    if (bid_id) {
      // ✅ UPDATE bid
      bid = await Bid.findByPk(Number(bid_id));
      if (!bid) {
        return res.status(404).json({ message: "Bid not found" });
      }
      await bid.update({
        requirement_id: Number(requirement_id),
        pl_details,
        bid_type,
        bid_details,
        status: bidStatus,
      });
    } else {
      // ✅ CREATE bid
      bid = await Bid.create({
        requirement_id: Number(requirement_id),
        pl_details,
        bid_type,
        bid_details,
        status: bidStatus,
      });
    }

    return res.status(200).json({
      message: bid_id ? "Bid updated successfully" : "Bid created successfully",
      bid: bid.toJSON(),
    });
  } catch (error: any) {
    console.error("Error processing bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getBidsForUserAndCompany = async (req: Request, res: Response) => {
  try {
    const { login_id, company_id } = req.body;
    console.log("Fetching bids for login_id:", login_id, "company_id:", company_id);

    if (!login_id || !company_id) {
      return res
        .status(400)
        .json({ message: "login_id and company_id are required" });
    }

    const bids = await Bid.findAll({
      where: {
        requirement_id: company_id,
      },
    });

    return res.status(200).json({
      bids: bids.map(b => b.toJSON()),
    });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getBidsCompanyList = async (req: any, res: Response) => {
  try {
    const { login_id } = req.body;

    if (!login_id) {
      return res.status(400).json({ message: "login_id is required" });
    }

    const bids = await Bid.findAll();
    
    // Get unique company IDs from requirements
    const companies = new Map();
    for (const bid of bids) {
      const requirement = await CompanyRequirements.findByPk(bid.requirement_id);
      if (requirement) {
        const companyInfo = requirement.toJSON();
        if (!companies.has(companyInfo.company_id)) {
          companies.set(companyInfo.company_id, {
            company_id: companyInfo.company_id,
            company_name: companyInfo.bid_details?.company_name || 'Unknown',
          });
        }
      }
    }

    if (companies.size === 0) {
      return res
        .status(404)
        .json({ message: "No companies found for this user" });
    }

    res.status(200).json(Array.from(companies.values()));
  } catch (err) {
    console.error("Error fetching company list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteBid = async (req: Request, res: Response) => {
  try {
    const { bid_id } = req.params;
    const loginId = (req as any).user?.id; // from auth middleware

    console.log("Deleting bid:", bid_id, "by user:", loginId);

    if (!bid_id) {
      return res.status(400).json({ message: "Bid ID is required" });
    }

    if (!loginId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const bid = await Bid.findByPk(Number(bid_id));

    if (!bid) {
      return res.status(403).json({
        message: "Bid not found or you are not allowed to delete this bid",
      });
    }

    // Check if bid status is 'submitted'
    if (bid.status?.toLowerCase() !== 'submitted') {
      return res.status(403).json({
        message: "Only submitted bids can be deleted",
      });
    }

    await bid.destroy();

    // ✅ Only send success message
    return res.status(200).json({ message: "Bid deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting bid:", error.message || error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


