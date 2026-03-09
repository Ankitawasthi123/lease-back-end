/**
 * Central exports for all models
 * Usage: import { User, Warehouse, Bid } from '../models';
 */

import User from './User';
import CompanyRequirements from './CompanyRequirements';
import Bid from './Bid';
import Warehouse from './Warehouse';
import Pitch from './Pitch';
import Retail from './Retail';
import RetailPitch from './RetailPitch';
import Payment from './Payment';
import QueryMessage from './QueryMessage';

// Set up associations
try {
	// Retail (property) has many RetailPitch entries; RetailPitch belongs to Retail
	if (typeof Retail.hasMany === 'function' && typeof RetailPitch.belongsTo === 'function') {
		Retail.hasMany(RetailPitch, { foreignKey: 'retail_id', as: 'pitches' });
		RetailPitch.belongsTo(Retail, { foreignKey: 'retail_id', as: 'retail' });
	}

	// Warehouse has many Pitch entries; Pitch belongs to Warehouse
	if (typeof Warehouse.hasMany === 'function' && typeof Pitch.belongsTo === 'function') {
		Warehouse.hasMany(Pitch, { foreignKey: 'warehouse_id', as: 'pitches' });
		Pitch.belongsTo(Warehouse, { foreignKey: 'warehouse_id', as: 'warehouse' });
	}
} catch (err) {
	// fail silently during type-only builds or when sequelize instances aren't fully initialized
	// runtime association errors will be surfaced in server logs
}

export { User, CompanyRequirements, Bid, Warehouse, Pitch, Retail, RetailPitch, Payment, QueryMessage };

// Type exports for TypeScript support
export * from './Warehouse';
