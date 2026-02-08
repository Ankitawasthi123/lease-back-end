/**
 * Example Usage of Models
 * This file demonstrates how to use all created models
 */

import { 
  User, 
  Warehouse, 
  Pitch, 
  Retail,
  RetailPitch,
  Bid,
  CompanyRequirements 
} from '../models';
import { Request, Response } from 'express';

// ============================================
// USER EXAMPLES
// ============================================

export const userExamples = {
  // Find user by email
  async findByEmail(email: string) {
    const user = await User.findOne({ where: { email } });
    return user;
  },

  // Create new user
  async createUser(userData: any) {
    const user = await User.create({
      first_name: userData.first_name,
      middle_name: userData.middle_name,
      last_name: userData.last_name,
      email: userData.email,
      password: userData.password, // Should be hashed!
      role: userData.role || 'user',
      contact_number: userData.contact_number,
      company_name: userData.company_name,
      designation: userData.designation,
    });
    return user;
  },

  // Update user status
  async updateStatus(userId: number, status: string) {
    const user = await User.findByPk(userId);
    if (!user) return null;
    await user.update({ status });
    return user;
  },

  // Find admin users
  async getAdmins() {
    const admins = await User.findAll({ where: { role: 'admin' } });
    return admins;
  },

  // Delete user
  async deleteUser(userId: number) {
    const user = await User.findByPk(userId);
    if (user) await user.destroy();
    return true;
  }
};

// ============================================
// WAREHOUSE EXAMPLES
// ============================================

export const warehouseExamples = {
  // Create warehouse
  async createWarehouse(data: any) {
    const warehouse = await Warehouse.create({
      login_id: data.login_id,
      warehouse_location: data.location,
      warehouse_size: data.size,
      warehouse_compliance: data.compliance,
      material_details: data.materials,
      status: 'submitted',
      company_details: data.company,
    });
    return warehouse;
  },

  // Get all warehouses for a user
  async getByUser(loginId: number) {
    const warehouses = await Warehouse.findAll({ 
      where: { login_id: loginId },
      order: [['created_date', 'DESC']]
    });
    return warehouses;
  },

  // Get approved warehouses
  async getApproved() {
    const warehouses = await Warehouse.findAll({ 
      where: { status: 'approved' }
    });
    return warehouses;
  },

  // Update warehouse
  async updateWarehouse(id: number, data: any) {
    const warehouse = await Warehouse.findByPk(id);
    if (!warehouse) return null;
    await warehouse.update(data);
    return warehouse;
  },

  // Get single warehouse with pitches
  async getWithPitches(id: number) {
    const warehouse = await Warehouse.findByPk(id);
    // Note: Add association first for this to work
    // const pitches = await warehouse.getPitches();
    return warehouse;
  }
};

// ============================================
// PITCH EXAMPLES
// ============================================

export const pitchExamples = {
  // Create pitch for warehouse
  async createPitch(data: any) {
    const pitch = await Pitch.create({
      warehouse_id: data.warehouse_id,
      login_id: data.login_id,
      warehouse_location: data.location,
      warehouse_size: data.size,
      warehouse_compliance: data.compliance,
      material_details: data.materials,
      justification: data.justification,
      rate_details: data.rates,
      image_files: data.images || [],
      pdf_files: data.pdfs || null,
      status: 'pending',
    });
    return pitch;
  },

  // Get pitches for warehouse
  async getForWarehouse(warehouseId: number) {
    const pitches = await Pitch.findAll({ 
      where: { warehouse_id: warehouseId }
    });
    return pitches;
  },

  // Get accepted pitches
  async getAccepted() {
    const pitches = await Pitch.findAll({ 
      where: { status: 'accepted' }
    });
    return pitches;
  },

  // Update pitch status
  async updateStatus(pitchId: number, status: string) {
    const pitch = await Pitch.findByPk(pitchId);
    if (!pitch) return null;
    await pitch.update({ status });
    return pitch;
  },

  // Delete pitch
  async deletePitch(pitchId: number) {
    const pitch = await Pitch.findByPk(pitchId);
    if (pitch) await pitch.destroy();
    return true;
  }
};

// ============================================
// RETAIL EXAMPLES
// ============================================

export const retailExamples = {
  // Create retail property
  async createRetail(data: any) {
    const retail = await Retail.create({
      login_id: data.login_id,
      retail_details: data.details,
      retail_type: data.types || [],
      retail_compliance: data.compliance || {},
      company_details: data.company || {},
      status: 'pending',
    });
    return retail;
  },

  // Get user's retail properties
  async getByUser(loginId: number) {
    const retails = await Retail.findAll({ 
      where: { login_id: loginId }
    });
    return retails;
  },

  // Update retail property
  async updateRetail(id: number, data: any) {
    const retail = await Retail.findByPk(id);
    if (!retail) return null;
    await retail.update(data);
    return retail;
  }
};

// ============================================
// RETAIL PITCH EXAMPLES
// ============================================

export const retailPitchExamples = {
  // Create retail pitch
  async createRetailPitch(data: any) {
    const pitch = await RetailPitch.create({
      retail_id: data.retail_id,
      login_id: data.login_id,
      retail_details: data.details || {},
      retail_compliance: data.compliance || {},
      property_type: data.property_type,
      justification: data.justification,
      company_details: data.company || {},
      image_files: data.images || [],
      pdf_files: data.pdfs || null,
      status: 'pending',
    });
    return pitch;
  },

  // Get pitches for retail
  async getForRetail(retailId: number) {
    const pitches = await RetailPitch.findAll({ 
      where: { retail_id: retailId }
    });
    return pitches;
  }
};

// ============================================
// COMPANY REQUIREMENTS EXAMPLES
// ============================================

export const requirementExamples = {
  // Create requirement
  async createRequirement(data: any) {
    const requirement = await CompanyRequirements.create({
      company_id: data.company_id,
      warehouse_location: data.location || {},
      warehouse_size: data.size || {},
      warehouse_compliance: data.compliance || {},
      material_details: data.materials || {},
      labour_details: data.labour || {},
      office_expenses: data.expenses || {},
      transport: data.transport || [],
      requirement_type: data.type,
      distance: data.distance || [],
      status: 'submitted',
    });
    return requirement;
  },

  // Get requirements by company
  async getByCompany(companyId: number) {
    const requirements = await CompanyRequirements.findAll({ 
      where: { company_id: companyId }
    });
    return requirements;
  },

  // Get open requirements
  async getOpen() {
    const requirements = await CompanyRequirements.findAll({ 
      where: { status: 'submitted' }
    });
    return requirements;
  }
};

// ============================================
// BID EXAMPLES
// ============================================

export const bidExamples = {
  // Create bid
  async createBid(data: any) {
    const bid = await Bid.create({
      requirement_id: data.requirement_id,
      pl_details: data.pl_details,
      bid_type: data.bid_type,
      bid_details: data.details || {},
      status: 'PENDING',
    });
    return bid;
  },

  // Get bids for requirement
  async getForRequirement(requirementId: number) {
    const bids = await Bid.findAll({ 
      where: { requirement_id: requirementId }
    });
    return bids;
  },

  // Update bid status
  async updateStatus(bidId: number, status: string) {
    const bid = await Bid.findByPk(bidId);
    if (!bid) return null;
    await bid.update({ status });
    return bid;
  },

  // Get accepted bids
  async getAccepted() {
    const bids = await Bid.findAll({ 
      where: { status: 'ACCEPTED' }
    });
    return bids;
  }
};

// ============================================
// CONTROLLER INTEGRATION EXAMPLE
// ============================================

export const controllerExample = {
  // Create warehouse endpoint
  async createWarehouseHandler(req: Request, res: Response) {
    try {
      const { login_id, warehouse_location, warehouse_size, status } = req.body;

      // Validate input
      if (!login_id || !warehouse_location) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create warehouse using model
      const warehouse = await Warehouse.create({
        login_id,
        warehouse_location,
        warehouse_size,
        status: status || 'submitted',
      });

      res.status(201).json({
        message: 'Warehouse created successfully',
        warehouse: warehouse.toJSON(),
      });
    } catch (error) {
      console.error('Create warehouse error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get warehouses endpoint
  async getWarehousesHandler(req: Request, res: Response) {
    try {
      const { login_id } = req.params;

      const warehouses = await Warehouse.findAll({
        where: { login_id: Number(login_id) },
        order: [['created_date', 'DESC']],
      });

      res.status(200).json({
        message: 'Warehouses retrieved successfully',
        warehouses: warehouses.map(w => w.toJSON()),
      });
    } catch (error) {
      console.error('Get warehouses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

// ============================================
// TRANSACTION EXAMPLE
// ============================================

export const transactionExample = {
  // Create warehouse with pitches in transaction
  async createWarehouseWithPitches(warehouseData: any, pitchesData: any[]) {
    const transaction = await require('../config/data-source').default.transaction();

    try {
      // Create warehouse
      const warehouse = await Warehouse.create(warehouseData, { transaction });

      // Create pitches
      const pitches = await Promise.all(
        pitchesData.map(pitchData =>
          Pitch.create(
            { ...pitchData, warehouse_id: warehouse.id },
            { transaction }
          )
        )
      );

      // Commit transaction if all succeeds
      await transaction.commit();

      return { warehouse, pitches };
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
  }
};

export default {
  userExamples,
  warehouseExamples,
  pitchExamples,
  retailExamples,
  retailPitchExamples,
  requirementExamples,
  bidExamples,
  controllerExample,
  transactionExample,
};
