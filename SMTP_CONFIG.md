# Konfigurasi SMTP untuk Fitur Email

Fitur kirim email memerlukan konfigurasi SMTP di file `.env` backend.

## Variabel Environment yang Diperlukan

Tambahkan variabel berikut di file `.env` di folder `proyek-toko-api`:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Toko Anda
```

## Contoh Konfigurasi untuk Provider Email Populer

### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Toko Anda
```

**Catatan untuk Gmail:**
- Anda perlu menggunakan **App Password**, bukan password biasa
- Aktifkan 2-Step Verification di akun Google Anda
- Buat App Password di: https://myaccount.google.com/apppasswords

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
SMTP_FROM_NAME=Toko Anda
```

### Yahoo Mail
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yahoo.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME=Toko Anda
```

### Custom SMTP Server
```env
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-password
SMTP_FROM_NAME=Toko Anda
```

## Penjelasan Variabel

- **SMTP_HOST**: Alamat server SMTP
- **SMTP_PORT**: Port SMTP (biasanya 587 untuk TLS, 465 untuk SSL)
- **SMTP_SECURE**: `true` untuk SSL (port 465), `false` untuk TLS (port 587)
- **SMTP_USER**: Username/email untuk autentikasi SMTP
- **SMTP_PASS**: Password atau App Password untuk autentikasi
- **SMTP_FROM_NAME**: Nama yang akan muncul sebagai pengirim email

## Troubleshooting

### Error: "Email service tidak dikonfigurasi"
- Pastikan semua variabel SMTP sudah diisi di file `.env`
- Restart backend server setelah mengubah `.env`

### Error: "Autentikasi SMTP gagal"
- Periksa username dan password
- Untuk Gmail, pastikan menggunakan App Password, bukan password biasa
- Pastikan 2-Step Verification sudah diaktifkan (untuk Gmail)

### Error: "Tidak dapat terhubung ke server SMTP"
- Periksa SMTP_HOST dan SMTP_PORT
- Pastikan firewall tidak memblokir koneksi
- Coba gunakan port alternatif (587 atau 465)

### Error: "Timeout saat mengirim email"
- Periksa koneksi internet
- Coba gunakan SMTP server yang berbeda
- Periksa apakah server SMTP sedang down

