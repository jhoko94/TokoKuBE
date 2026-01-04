# Troubleshooting JWT Token Error

## Status Saat Ini

✅ **JWT_SECRET**: Sudah di-set di `.env`
✅ **UserRole lookup table**: Sudah ter-populate (ADMIN, KASIR, MANAGER)
✅ **Users**: Semua user sudah punya roleId
✅ **Backend code**: Sudah menggunakan `process.env.JWT_SECRET`

## Error yang Terjadi

```
GET http://localhost:3001/api/store 500 (Internal Server Error)
Gagal memverifikasi token: Error: Gagal memverifikasi token
```

## Solusi

### 1. Restart Backend Server

**PENTING**: Setelah menambahkan `JWT_SECRET` ke `.env`, backend HARUS di-restart!

```bash
# Stop server (Ctrl+C di terminal backend)
# Lalu jalankan lagi:
cd proyek-toko-api
npm run dev
```

### 2. Clear LocalStorage di Frontend

Token lama di localStorage masih menggunakan secret lama. Clear dan login ulang:

**Cara 1: Via Browser Console**
1. Buka browser console (F12)
2. Jalankan:
```javascript
localStorage.clear()
location.reload()
```

**Cara 2: Via Aplikasi**
1. Logout dari aplikasi
2. Login lagi dengan username dan password

### 3. Verifikasi JWT_SECRET Ter-load

Setelah restart backend, cek console backend apakah ada error. Jika JWT_SECRET ter-load dengan benar, tidak akan ada error.

### 4. Test Manual

Test endpoint dengan token baru:

```bash
# 1. Login untuk dapat token baru
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 2. Gunakan token dari response untuk test store endpoint
curl -X GET http://localhost:3001/api/store \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Checklist

- [ ] Backend sudah di-restart setelah menambahkan JWT_SECRET
- [ ] LocalStorage sudah di-clear
- [ ] Login ulang dengan username dan password
- [ ] Backend console tidak ada error saat start
- [ ] Request ke `/api/store` berhasil (tidak error 500)

## Jika Masih Error

1. Cek backend console untuk error detail
2. Pastikan `.env` file ada di root folder `proyek-toko-api`
3. Pastikan `JWT_SECRET` ada di `.env` (tanpa spasi di sekitar `=`)
4. Cek apakah ada error di Prisma query (user.role mungkin null)

