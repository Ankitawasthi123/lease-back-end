# 🚀 Models Quick Reference

## 7 Models Created

```
User                    → User authentication & profiles
CompanyRequirements     → Company space requirements
Bid                     → Bids on requirements
Warehouse               → Warehouse property listings
Pitch                   → Pitches for warehouse opportunities
Retail                  → Retail property listings
RetailPitch             → Pitches for retail opportunities
```

---

## ⚡ Quick Import

```typescript
import { 
  User, 
  CompanyRequirements, 
  Bid, 
  Warehouse, 
  Pitch, 
  Retail, 
  RetailPitch 
} from '../models';
```

---

## 🔧 CRUD Cheatsheet

### CREATE
```typescript
const warehouse = await Warehouse.create({ login_id: 1, status: 'submitted' });
```

### READ
```typescript
const warehouse = await Warehouse.findByPk(1);
const warehouses = await Warehouse.findAll({ where: { login_id: 1 } });
const one = await Warehouse.findOne({ where: { status: 'approved' } });
```

### UPDATE
```typescript
const warehouse = await Warehouse.findByPk(1);
await warehouse.update({ status: 'approved' });
```

### DELETE
```typescript
const warehouse = await Warehouse.findByPk(1);
await warehouse.destroy();
```

---

## 📚 Where to Find What

| Need | File |
|------|------|
| Full field docs | `src/models/MODELS_DOCUMENTATION.md` |
| Code examples | `src/models/EXAMPLES.ts` |
| Setup guide | `MODELS_SETUP.md` |
| This summary | `MODELS_SUMMARY.md` |
| Quick ref | This file |

---

## ✅ All Models Ready!

Start using them in your controllers right away!
