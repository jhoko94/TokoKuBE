# Migration Guide: Enum to Lookup Tables

Dokumen ini menjelaskan langkah-langkah migrasi dari enum ke tabel lookup.

## Perubahan yang Dilakukan

### 1. Tabel Lookup Baru
- **UserRole** - Menggantikan enum UserRole
- **CustomerType** - Menggantikan enum CustomerType  
- **TransactionType** - Menggantikan enum TransactionType

### 2. Enum yang Diganti dengan String
- **POStatus** - Sekarang String ('PENDING', 'COMPLETED')
- **ReturStatus** - Sekarang String ('PENDING', 'APPROVED', 'REJECTED')
- **StockChangeType** - Sekarang String ('IN', 'OUT', 'ADJUSTMENT', dll)

## Langkah Migrasi

### Step 1: Backup Database
```bash
# Backup database sebelum migrasi
pg_dump -U postgres -d tokodb > backup_before_enum_migration.sql
```

### Step 2: Update Schema dan Generate Migration
```bash
cd proyek-toko-api

# Generate Prisma client dengan schema baru
npx prisma generate

# Buat migration baru
npx prisma migrate dev --name replace_enum_with_lookup_tables
```

### Step 3: Populate Lookup Tables
```bash
# Jalankan seed untuk populate lookup tables
npm run db:seed
```

### Step 4: Migrasi Data Existing (Jika Ada)

Jika Anda sudah punya data existing, jalankan script migrasi data:

```bash
node prisma/migrate-enum-to-tables.js
```

**PENTING**: Script ini hanya untuk referensi. Untuk production, Anda perlu membuat SQL migration manual untuk:
1. Convert enum values di User.role ke User.roleId
2. Convert enum values di Customer.type ke Customer.typeId  
3. Convert enum values di Transaction.type ke Transaction.typeId

### Step 5: Verifikasi

1. Cek apakah semua lookup table sudah ter-populate:
```sql
SELECT * FROM "UserRole";
SELECT * FROM "CustomerType";
SELECT * FROM "TransactionType";
```

2. Cek apakah data user sudah ter-migrasi:
```sql
SELECT u.id, u.username, ur.code, ur.name 
FROM "User" u 
LEFT JOIN "UserRole" ur ON u."roleId" = ur.id;
```

3. Test API endpoints untuk memastikan semua berfungsi

## Breaking Changes

### API Changes

1. **User Role**: 
   - Sebelum: `role: "ADMIN"` (string langsung)
   - Sesudah: `role: { id: "...", code: "ADMIN", name: "Administrator" }` (object)
   - Untuk backward compatibility, middleware auth masih mengembalikan `role` sebagai string code

2. **Customer Type**:
   - Sebelum: `type: "UMUM"` (string langsung)
   - Sesudah: `type: { id: "...", code: "UMUM", name: "Pelanggan Umum", canBon: false }` (object)

3. **Transaction Type**:
   - Sebelum: `type: "LUNAS"` (string langsung)
   - Sesudah: `type: { id: "...", code: "LUNAS", name: "Lunas" }` (object)

4. **PO Status, Retur Status, Stock Change Type**:
   - Tetap string, tidak ada perubahan format

### Request Body Changes

Saat membuat/update user, customer, atau transaction, tetap bisa menggunakan code:
```json
{
  "role": "ADMIN"  // Akan dikonversi ke roleId otomatis
}
```

## Rollback (Jika Diperlukan)

Jika perlu rollback:

1. Restore database dari backup
2. Revert Prisma migration:
```bash
npx prisma migrate resolve --rolled-back replace_enum_with_lookup_tables
```

## Notes

- Semua enum sudah dihapus dari schema
- Tabel lookup bisa di-manage melalui API (jika diperlukan di masa depan)
- Metadata seperti `canBon` untuk CustomerType memungkinkan validasi bisnis yang lebih fleksibel

