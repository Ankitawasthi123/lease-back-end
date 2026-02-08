# Database Models Documentation

This document describes all the database models in the application.

## Models Overview

### 1. **User** [src/models/User.ts](User.ts)
Represents user accounts in the system.

**Fields:**
- `id` (INTEGER, PK) - User ID
- `first_name` (STRING) - User's first name
- `middle_name` (STRING) - User's middle name
- `last_name` (STRING) - User's last name
- `email` (STRING, UNIQUE) - User email
- `contact_number` (STRING) - Phone number
- `password` (STRING) - Hashed password
- `role` (STRING) - User role (user, admin, etc.)
- `company_name` (STRING) - Company name
- `designation` (STRING) - Job designation
- `company_info` (JSONB) - Company information
- `registered_address` (JSONB) - Registered address details
- `communication_address` (JSONB) - Communication address
- `director_info` (JSONB) - Director information
- `filler_info` (JSONB) - Additional filler information
- `email_otp` (STRING) - Email OTP for verification
- `mobile_otp` (STRING) - Mobile OTP for verification
- `otp_expires_at` (DATE) - OTP expiration time
- `mobile_verified` (BOOLEAN) - Mobile verification status
- `email_verified` (BOOLEAN) - Email verification status
- `profile_image` (STRING) - Profile image filename
- `status` (STRING) - User status
- `createdAt` (DATE) - Account creation date
- `updatedAt` (DATE) - Last update date

---

### 2. **CompanyRequirements** [src/models/CompanyRequirements.ts](CompanyRequirements.ts)
Stores company requirements for warehouse/retail spaces.

**Fields:**
- `id` (INTEGER, PK) - Requirement ID
- `company_id` (INTEGER) - Associated company
- `warehouse_location` (JSONB) - Location details
- `warehouse_size` (JSONB) - Size specifications
- `warehouse_compliance` (JSONB) - Compliance requirements
- `material_details` (JSONB) - Material specifications
- `labour_details` (JSONB) - Labour requirements
- `office_expenses` (JSONB) - Office expense details
- `transport` (JSONB) - Transport details (array)
- `requirement_type` (STRING) - Type of requirement
- `bid_details` (JSONB) - Bid details
- `distance` (JSONB) - Distance specifications (array)
- `status` (STRING) - Requirement status (submitted, approved, rejected, etc.)
- `created_date` (DATE) - Creation date
- `updated_at` (DATE) - Last update date

---

### 3. **Bid** [src/models/Bid.ts](Bid.ts)
Represents bids submitted for company requirements.

**Fields:**
- `id` (INTEGER, PK) - Bid ID
- `requirement_id` (INTEGER, FK) - Associated requirement
- `pl_details` (JSONB) - P&L (Profit/Loss) details
- `bid_type` (STRING) - Type of bid
- `bid_details` (JSONB) - Detailed bid information
- `status` (STRING) - Bid status (PENDING, ACCEPTED, REJECTED, etc.)
- `created_date` (DATE) - Bid creation date
- `updated_at` (DATE) - Last update date

---

### 4. **Warehouse** [src/models/warehouse.ts](warehouse.ts)
Stores warehouse property information.

**Fields:**
- `id` (INTEGER, PK) - Warehouse ID
- `login_id` (INTEGER) - Associated user
- `warehouse_location` (JSONB) - Location coordinates/address
- `warehouse_size` (JSONB) - Size specifications
- `warehouse_compliance` (JSONB) - Compliance standards
- `material_details` (JSONB) - Material specifications
- `status` (STRING) - Warehouse status (submitted, approved, etc.)
- `company_details` (JSONB) - Associated company info
- `created_date` (DATE) - Creation date
- `updated_at` (DATE) - Last update date

---

### 5. **Pitch** [src/models/Pitch.ts](Pitch.ts)
Represents pitches made for warehouse opportunities.

**Fields:**
- `id` (INTEGER, PK) - Pitch ID
- `warehouse_id` (INTEGER) - Associated warehouse
- `login_id` (INTEGER) - Pitcher's user ID
- `warehouse_location` (STRING) - Location name
- `warehouse_size` (JSONB) - Size specifications
- `warehouse_compliance` (JSONB) - Compliance details
- `material_details` (JSONB) - Material specifications
- `justification` (TEXT) - Pitch justification
- `image_files` (JSONB) - Uploaded images (array of file objects)
- `pdf_files` (JSONB) - Uploaded PDF documents
- `rate_details` (JSONB) - Rate/pricing details
- `status` (STRING) - Pitch status (pending, accepted, rejected)
- `pitcher_details` (JSONB) - Pitcher information
- `created_date` (DATE) - Creation date
- `updated_at` (DATE) - Last update date

---

### 6. **Retail** [src/models/Retail.ts](Retail.ts)
Stores retail property information.

**Fields:**
- `id` (INTEGER, PK) - Retail ID
- `login_id` (INTEGER) - Associated user
- `retail_details` (STRING) - Retail property details
- `retail_type` (JSONB) - Type of retail (array)
- `retail_compliance` (JSONB) - Compliance requirements
- `status` (STRING) - Retail status (pending, approved, etc.)
- `company_details` (JSONB) - Associated company info
- `created_date` (DATE) - Creation date
- `updated_at` (DATE) - Last update date

---

### 7. **RetailPitch** [src/models/RetailPitch.ts](RetailPitch.ts)
Represents pitches made for retail opportunities.

**Fields:**
- `id` (INTEGER, PK) - Pitch ID
- `retail_id` (INTEGER) - Associated retail property
- `login_id` (INTEGER) - Pitcher's user ID
- `retail_details` (JSONB) - Retail property details
- `retail_compliance` (JSONB) - Compliance specifications
- `property_type` (STRING) - Type of retail property
- `justification` (TEXT) - Pitch justification
- `company_details` (JSONB) - Company information
- `image_files` (JSONB) - Uploaded images (array)
- `pdf_files` (JSONB) - Uploaded PDF documents
- `status` (STRING) - Pitch status
- `created_date` (DATE) - Creation date
- `updated_at` (DATE) - Last update date

---

## Model Relationships

```
User
├── CompanyRequirements (company_id)
├── Warehouse (login_id)
├── Pitch (login_id)
├── Retail (login_id)
└── RetailPitch (login_id)

CompanyRequirements
└── Bid (requirement_id)

Warehouse
└── Pitch (warehouse_id)

Retail
└── RetailPitch (retail_id)
```

---

## Usage Examples

### Importing Models

```typescript
// Option 1: Individual imports
import User from '../models/User';
import Warehouse from '../models/Warehouse';

// Option 2: Bulk import from index
import { User, Warehouse, Pitch, Retail } from '../models';
```

### Creating Records

```typescript
import { Warehouse } from '../models';

// Create a warehouse
const warehouse = await Warehouse.create({
  login_id: 1,
  warehouse_location: { lat: 40.7128, lng: -74.0060 },
  warehouse_size: { sqft: 10000 },
  status: 'submitted',
});
```

### Querying Records

```typescript
import { Pitch } from '../models';

// Find by ID
const pitch = await Pitch.findByPk(1);

// Find by attribute
const pitches = await Pitch.findAll({ 
  where: { login_id: 5, status: 'accepted' } 
});

// Find one with conditions
const pitch = await Pitch.findOne({ 
  where: { warehouse_id: 10 } 
});
```

### Updating Records

```typescript
const warehouse = await Warehouse.findByPk(1);
await warehouse.update({ status: 'approved' });
```

### Deleting Records

```typescript
const bid = await Bid.findByPk(1);
await bid.destroy();
```

---

## Data Type Mapping

| Sequelize Type | PostgreSQL Type | Usage |
|---|---|---|
| INTEGER | INT | IDs, numbers |
| STRING | VARCHAR | Text fields (max length) |
| TEXT | TEXT | Long text (no length limit) |
| DATE | TIMESTAMP | Dates and times |
| JSONB | JSONB | JSON objects/arrays |
| BOOLEAN | BOOLEAN | True/False values |

---

## Notes

1. **JSONB Fields** - All complex objects are stored as JSONB for flexibility and query support
2. **Timestamps** - `created_date` and `updated_at` are automatically managed
3. **Status Fields** - Common values: `pending`, `submitted`, `approved`, `rejected`, `accepted`
4. **File Storage** - Files are stored as objects with `filename`, `mimetype`, `size`, `url` properties
5. **Foreign Keys** - Relationships are stored as integer IDs (manual management via where clauses)

---

## Next Steps

1. **Add Associations** - Define Sequelize model associations for easier querying
2. **Add Validations** - Add custom validators for data integrity
3. **Add Hooks** - Add pre/post save hooks for automatic timestamp updates
4. **Add Scopes** - Define common query scopes for reusability
5. **Create Migrations** - Generate Sequelize migrations for schema management
