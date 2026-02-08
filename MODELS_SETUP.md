# 📁 Models Setup Guide

All database models have been created and saved in the `src/models/` folder.

## ✅ Created Models

| Model | File | Table | Description |
|-------|------|-------|-------------|
| **User** | `User.ts` | `users` | User accounts and authentication |
| **CompanyRequirements** | `CompanyRequirements.ts` | `company_requirements` | Company requirements for spaces |
| **Bid** | `Bid.ts` | `bids` | Bids on requirements |
| **Warehouse** | `warehouse.ts` | `warehouse` | Warehouse property listings |
| **Pitch** | `Pitch.ts` | `pitches` | Pitches for warehouse opportunities |
| **Retail** | `Retail.ts` | `retail` | Retail property listings |
| **RetailPitch** | `RetailPitch.ts` | `retail_pitches` | Pitches for retail opportunities |

---

## 📂 File Structure

```
src/models/
├── index.ts                          ← Central export file
├── MODELS_DOCUMENTATION.md           ← Full model documentation
├── User.ts                           ← User model
├── CompanyRequirements.ts            ← CompanyRequirements model
├── Bid.ts                            ← Bid model
├── warehouse.ts                      ← Warehouse model (updated with model class)
├── Pitch.ts                          ← Pitch model
├── Retail.ts                         ← Retail model
└── RetailPitch.ts                    ← RetailPitch model
```

---

## 🚀 Usage

### Option 1: Import from Index (Recommended)

```typescript
import { 
  User, 
  Warehouse, 
  Pitch, 
  Retail,
  CompanyRequirements,
  Bid,
  RetailPitch 
} from '../models';

// Use models directly
const warehouse = await Warehouse.findByPk(1);
```

### Option 2: Individual Imports

```typescript
import Warehouse from '../models/warehouse';
import Pitch from '../models/Pitch';

const warehouse = await Warehouse.findByPk(1);
```

---

## 📋 Quick Reference

### Create a Record

```typescript
import { Warehouse } from '../models';

const newWarehouse = await Warehouse.create({
  login_id: 1,
  warehouse_location: { lat: 40.7128, lng: -74.0060 },
  warehouse_size: { sqft: 5000 },
  status: 'submitted',
});
```

### Find Records

```typescript
import { Pitch } from '../models';

// Find by primary key
const pitch = await Pitch.findByPk(1);

// Find all matching conditions
const pitches = await Pitch.findAll({ 
  where: { login_id: 5, status: 'accepted' } 
});

// Find one matching conditions
const pitch = await Pitch.findOne({ 
  where: { warehouse_id: 10 } 
});
```

### Update a Record

```typescript
const warehouse = await Warehouse.findByPk(1);
await warehouse.update({ 
  status: 'approved',
  warehouse_size: { sqft: 6000 }
});
```

### Delete a Record

```typescript
const bid = await Bid.findByPk(1);
await bid.destroy();
```

---

## 🔑 Key Features

✅ **Type-Safe** - Full TypeScript support with proper typing
✅ **Standardized** - All models follow Sequelize patterns
✅ **Centralized** - Single `index.ts` for easy imports
✅ **Documented** - Each model has clear field definitions
✅ **JSONB Support** - Complex data stored as JSON
✅ **Timestamps** - Automatic `created_date` and `updated_at`

---

## 📝 Field Types

All models use these field types:

| Type | Usage | Example |
|------|-------|---------|
| `INTEGER` | IDs, counts | user_id, login_id |
| `STRING` | Short text | status, retail_type |
| `TEXT` | Long text | justification, description |
| `JSONB` | Complex objects | location, compliance |
| `DATE` | Timestamps | created_date, updated_at |
| `BOOLEAN` | Yes/No | email_verified, mobile_verified |

---

## 🔄 Model Relationships

```
User
├── owns multiple CompanyRequirements (via company_id)
├── owns multiple Warehouses (via login_id)
├── owns multiple Pitches (via login_id)
├── owns multiple Retails (via login_id)
└── owns multiple RetailPitches (via login_id)

CompanyRequirements
└── receives multiple Bids

Warehouse
└── receives multiple Pitches

Retail
└── receives multiple RetailPitches
```

---

## ⚠️ Important Notes

1. **JSONB Fields** - Store flexible JSON data
   ```typescript
   warehouse_location: { lat: 40.7128, lng: -74.0060 }
   warehouse_compliance: { fire_safety: true, emergency_exit: true }
   ```

2. **File References** - Store file metadata
   ```typescript
   image_files: [
     { filename: "img1.jpg", mimetype: "image/jpeg", size: 5000, url: "/uploads/..." }
   ]
   ```

3. **Status Fields** - Use consistent values
   - Warehouse/Retail: `pending`, `submitted`, `approved`, `rejected`
   - Bid: `PENDING`, `ACCEPTED`, `REJECTED`
   - Pitch: `pending`, `accepted`, `rejected`

4. **Timestamps** - Auto-managed
   - `created_date` - Set on creation
   - `updated_at` - Updated on any change

---

## 🔗 Next Steps

1. **Update Controllers** - Replace raw SQL with model queries
2. **Add Associations** - Define Sequelize model relations
3. **Add Validations** - Validate data before saving
4. **Add Hooks** - Auto-update timestamps, encrypt passwords
5. **Create Migrations** - Manage schema versions

---

## 📚 Documentation

For detailed field descriptions, see [MODELS_DOCUMENTATION.md](MODELS_DOCUMENTATION.md)

---

## ✨ All Models Ready!

All 7 models are created, typed, and ready to use in your controllers.

Replace raw SQL queries with Sequelize model methods for:
- Better type safety
- Automatic validation
- Easier testing
- Cleaner code
