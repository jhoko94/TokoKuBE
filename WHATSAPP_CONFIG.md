# Konfigurasi WhatsApp untuk Fitur Kirim Pesan

Fitur kirim pesan WhatsApp memerlukan konfigurasi provider WhatsApp di file `.env` backend.

## Variabel Environment yang Diperlukan

Pilih salah satu provider dan konfigurasi sesuai:

### Opsi 1: Twilio WhatsApp API (Recommended untuk Production)

```env
# WhatsApp Provider Configuration
WHATSAPP_PROVIDER=twilio

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Cara Setup:**
1. Daftar di [Twilio](https://www.twilio.com/)
2. Dapatkan Account SID dan Auth Token dari dashboard
3. Aktifkan WhatsApp Sandbox atau WhatsApp Business API
4. Dapatkan nomor WhatsApp dari Twilio

### Opsi 2: WhatsApp Cloud API (Recommended - Paling Mudah)

WhatsApp Cloud API adalah solusi resmi dari Meta yang lebih mudah setup dibandingkan WhatsApp Business API tradisional.

```env
# WhatsApp Provider Configuration
WHATSAPP_PROVIDER=cloud

# WhatsApp Cloud API Configuration
WHATSAPP_CLOUD_ACCESS_TOKEN=your-access-token
WHATSAPP_CLOUD_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_CLOUD_API_VERSION=v18.0  # Optional, default: v18.0
```

**Cara Setup:**
1. Buka [Meta for Developers](https://developers.facebook.com/)
2. Buat App baru atau gunakan App yang sudah ada
3. Tambahkan produk "WhatsApp" ke App Anda
4. Di halaman WhatsApp, klik "Get Started" atau "Set up"
5. Ikuti wizard untuk setup:
   - Pilih "Use this phone number" atau "Add phone number"
   - Verifikasi nomor telepon Anda (akan menerima kode via SMS/WhatsApp)
6. Setelah setup selesai, Anda akan mendapatkan:
   - **Phone Number ID**: Dapat dilihat di halaman WhatsApp → API Setup
   - **Access Token**: Dapat dilihat di halaman WhatsApp → API Setup (temporary token) atau buat System User untuk permanent token
7. Copy Phone Number ID dan Access Token ke file `.env`

**Membuat Permanent Access Token (Recommended):**
1. Di Meta for Developers, buka App Settings → System Users
2. Buat System User baru atau gunakan yang sudah ada
3. Assign role "WhatsApp Administrator" ke System User
4. Generate token untuk System User dengan permission `whatsapp_business_messaging` dan `whatsapp_business_management`
5. Gunakan token ini sebagai `WHATSAPP_CLOUD_ACCESS_TOKEN`

**Keuntungan WhatsApp Cloud API:**
- Setup lebih mudah (tidak perlu verifikasi bisnis untuk testing)
- Gratis untuk testing (dengan limit tertentu)
- Langsung bisa digunakan setelah setup
- Mendukung template messages dan interactive messages

**Test Numbers (Untuk Testing):**
- Di halaman WhatsApp → API Setup, Anda bisa menambahkan test numbers
- Nomor yang ditambahkan sebagai test number bisa langsung menerima pesan tanpa perlu verifikasi
- Untuk production, nomor tujuan harus sudah verified atau menggunakan template message

**Rate Limits:**
- Free tier: 1,000 conversations per bulan (gratis)
- Setelah itu, dikenakan biaya per conversation
- Lihat [WhatsApp Cloud API Pricing](https://developers.facebook.com/docs/whatsapp/pricing) untuk detail

**Template Messages:**
- Untuk pesan promosi/marketing, WAJIB menggunakan template message yang sudah disetujui Meta
- Template message harus dibuat dan disetujui terlebih dahulu di Meta App
- Pesan biasa (non-template) hanya bisa dikirim dalam 24 jam setelah customer membalas

### Opsi 3: Meta WhatsApp Business API (Traditional)

```env
# WhatsApp Provider Configuration
WHATSAPP_PROVIDER=meta

# Meta WhatsApp Business API Configuration
META_WHATSAPP_API_URL=https://graph.facebook.com/v18.0
META_WHATSAPP_ACCESS_TOKEN=your-access-token
META_WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
```

**Cara Setup:**
1. Buat WhatsApp Business Account di [Meta for Developers](https://developers.facebook.com/)
2. Buat App dan dapatkan Access Token
3. Dapatkan Phone Number ID dari WhatsApp Business API
4. Lakukan verifikasi bisnis (untuk production)

### Opsi 4: Custom API (Generic HTTP API)

```env
# WhatsApp Provider Configuration
WHATSAPP_PROVIDER=custom

# Custom API Configuration
WHATSAPP_API_URL=https://api.example.com/whatsapp/send
WHATSAPP_API_KEY=your-api-key
WHATSAPP_API_EXTRA_PARAMS={"param1":"value1"}  # Optional: JSON string untuk parameter tambahan
```

**Format Request yang Diharapkan:**
```json
POST /whatsapp/send
Headers: {
  "Authorization": "Bearer {WHATSAPP_API_KEY}",
  "Content-Type": "application/json"
}
Body: {
  "phone": "6281234567890",
  "message": "Pesan Anda"
}
```

### Opsi 5: Generic (Fallback - Generate WhatsApp URL)

Jika tidak ada provider yang dikonfigurasi, sistem akan generate WhatsApp URL yang bisa dibuka di browser:

```env
# WhatsApp Provider Configuration (optional, default: api)
WHATSAPP_PROVIDER=api
```

**Catatan:** Mode ini hanya generate URL, tidak mengirim otomatis. User perlu membuka URL di browser.

## Format Nomor Telepon

Sistem akan otomatis memformat nomor telepon:
- Menghapus karakter non-digit
- Menambahkan kode negara 62 (Indonesia) jika belum ada
- Contoh: `081234567890` → `6281234567890`

## Fitur yang Tersedia

1. **Single Send**: Kirim pesan ke 1 pelanggan
2. **Bulk Send**: Kirim pesan ke banyak pelanggan sekaligus
3. **Batch Processing**: 10 pesan per batch dengan delay 1 detik
4. **Error Handling**: Retry otomatis dan error reporting

## Troubleshooting

### Error: "WhatsApp service tidak dikonfigurasi"
- Pastikan `WHATSAPP_PROVIDER` sudah diisi di file `.env`
- Pastikan semua variabel konfigurasi provider sudah diisi
- Restart backend server setelah mengubah `.env`

### Error: "Nomor telepon tidak valid"
- Pastikan nomor telepon pelanggan sudah diisi
- Format nomor akan otomatis diperbaiki oleh sistem

### Error: "API error" atau "Configuration not found"
- Periksa kredensial API (Account SID, Auth Token, Access Token, dll)
- Pastikan API key valid dan tidak expired
- Periksa URL API endpoint (untuk custom API)

### WhatsApp tidak terkirim (Twilio)
- Pastikan nomor WhatsApp sudah terdaftar di Twilio Sandbox
- Untuk production, pastikan sudah approved untuk WhatsApp Business API
- Periksa billing Twilio (pastikan ada kredit)

### WhatsApp tidak terkirim (WhatsApp Cloud API)
- Pastikan Access Token masih valid (temporary token expired setelah 24 jam, gunakan System User token untuk permanent)
- Periksa Phone Number ID sudah benar (bukan App ID atau Page ID)
- Pastikan nomor telepon sudah terverifikasi di Meta App
- Periksa rate limits di Meta Developer Console
- Pastikan nomor tujuan sudah terdaftar di test numbers (untuk testing) atau sudah verified (untuk production)
- Untuk pesan promosi, pastikan menggunakan template message yang sudah disetujui

### WhatsApp tidak terkirim (Meta Business API)
- Pastikan Access Token masih valid
- Periksa Phone Number ID sudah benar
- Pastikan WhatsApp Business Account sudah verified
- Periksa rate limits di Meta Developer Console

## Catatan Penting

1. **Rate Limiting**: Setiap provider memiliki rate limit. Sistem sudah mengimplementasikan delay antar pesan untuk menghindari rate limiting.

2. **Biaya**: WhatsApp Business API biasanya berbayar. Pastikan Anda memahami pricing dari provider yang dipilih.

3. **Template Messages**: Untuk WhatsApp Business API, pesan promosi biasanya harus menggunakan template yang sudah disetujui. Pesan biasa hanya bisa dikirim dalam 24 jam setelah customer membalas.

4. **Privacy**: Pastikan Anda mematuhi regulasi privasi dan mendapatkan persetujuan dari pelanggan sebelum mengirim pesan WhatsApp.

## Testing

Untuk testing tanpa provider:
1. Gunakan `WHATSAPP_PROVIDER=api` (default)
2. Sistem akan generate WhatsApp URL
3. Buka URL di browser untuk test manual

Untuk testing dengan provider:
1. Setup provider sesuai dokumentasi di atas
2. Test dengan 1 pelanggan terlebih dahulu
3. Jika berhasil, test dengan bulk send

