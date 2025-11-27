const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const prisma = new PrismaClient();

// Setup email transporter (gunakan environment variables)
const createTransporter = () => {
  // Jika tidak ada konfigurasi email, return null (email tidak akan dikirim)
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Email configuration not found. Email feature will be disabled.');
    return null;
  }

  try {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch (error) {
    console.error('Error creating email transporter:', error);
    return null;
  }
};

// GET /api/customers - Get all customers dengan pagination
exports.getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const where = search ? {
      name: { contains: search, mode: 'insensitive' }
    } : {};

    const total = await prisma.customer.count({ where });

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    res.json({
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data pelanggan', details: error.message });
  }
};

// GET /api/customers/:id - Get single customer
exports.getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data pelanggan', details: error.message });
  }
};

// POST /api/customers - Create new customer
exports.createCustomer = async (req, res) => {
  const { name, type, address, phone, email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nama pelanggan harus diisi' });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        type: type || 'UMUM',
        address: address || null,
        phone: phone || null,
        email: email || null,
      }
    });

    res.status(201).json(customer);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Pelanggan dengan nama tersebut sudah ada' });
    }
    res.status(500).json({ error: 'Gagal membuat pelanggan', details: error.message });
  }
};

// PUT /api/customers/:id - Update customer
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, type, address, phone, email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nama pelanggan harus diisi' });
  }

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        type,
        address: address || null,
        phone: phone || null,
        email: email || null,
      }
    });

    res.json(customer);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }
    res.status(500).json({ error: 'Gagal mengupdate pelanggan', details: error.message });
  }
};

// DELETE /api/customers/:id - Delete customer
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    // Cek apakah customer punya transaksi atau utang
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        transactions: true,
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    if (customer.transactions.length > 0) {
      return res.status(400).json({ error: 'Tidak bisa menghapus pelanggan yang sudah memiliki transaksi' });
    }

    if (Number(customer.debt) > 0) {
      return res.status(400).json({ error: 'Tidak bisa menghapus pelanggan yang masih memiliki utang' });
    }

    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus pelanggan', details: error.message });
  }
};

// GET /api/customers/debt
exports.getCustomersWithDebt = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Gunakan Prisma query dengan filter yang benar untuk Decimal
    // Prisma seharusnya handle Decimal comparison dengan benar
    const where = {
      debt: { 
        gt: 0  // Prisma akan handle konversi untuk Decimal
      },
      ...(search && {
        name: { 
          contains: search,
          mode: 'insensitive' 
        }
      })
    };

    // Get total count
    const total = await prisma.customer.count({ where });

    // Get paginated customers
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    });

    // Debug: log hasil query
    console.log(`[getCustomersWithDebt] Found ${customers.length} customers with debt (total: ${total})`);

    res.json({
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Error in getCustomersWithDebt:', error);
    res.status(500).json({ error: 'Gagal mengambil data utang', details: error.message });
  }
};

// POST /api/customers/:id/pay-debt
exports.payDebt = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Jumlah bayar tidak valid' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (amount > customer.debt) {
      return res.status(400).json({ error: 'Jumlah bayar melebihi utang' });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        debt: {
          decrement: amount,
        },
      },
    });
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan pembayaran' });
  }
};

// POST /api/customers/:id/send-email
exports.sendEmail = async (req, res) => {
  const { id } = req.params;
  const { subject, message } = req.body;

  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'Subject email harus diisi' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan email harus diisi' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id } });
    
    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    if (!customer.email) {
      return res.status(400).json({ error: 'Pelanggan tidak memiliki alamat email' });
    }

    const transporter = createTransporter();
    if (!transporter) {
      return res.status(503).json({ 
        error: 'Email service tidak dikonfigurasi. Silakan hubungi administrator untuk mengatur SMTP settings.' 
      });
    }

    // Kirim email
    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'Toko'}" <${process.env.SMTP_USER}>`,
      to: customer.email,
      subject: subject.trim(),
      html: message.trim().replace(/\n/g, '<br>'), // Convert newlines to <br>
      text: message.trim(), // Plain text version
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      to: customer.email,
      subject: subject
    });
    
    res.json({
      message: 'Email berhasil dikirim',
      messageId: info.messageId,
      to: customer.email,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Berikan error message yang lebih informatif
    let errorMessage = 'Gagal mengirim email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Autentikasi SMTP gagal. Periksa username dan password email.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Tidak dapat terhubung ke server SMTP. Periksa konfigurasi SMTP_HOST dan SMTP_PORT.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Timeout saat mengirim email. Periksa koneksi internet dan konfigurasi SMTP.';
    } else if (error.response) {
      errorMessage = `Server SMTP menolak: ${error.response}`;
    } else {
      errorMessage = error.message || 'Gagal mengirim email';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function untuk mendapatkan atau membuat quota harian
const getOrCreateDailyQuota = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set ke awal hari

  let quota = await prisma.emailQuota.findUnique({
    where: { date: today }
  });

  if (!quota) {
    quota = await prisma.emailQuota.create({
      data: {
        date: today,
        count: 0
      }
    });
  }

  return quota;
};

// Helper function untuk increment quota
const incrementQuota = async (amount = 1) => {
  const quota = await getOrCreateDailyQuota();
  return await prisma.emailQuota.update({
    where: { id: quota.id },
    data: { count: { increment: amount } }
  });
};

// Helper function untuk send email dengan retry
const sendEmailWithRetry = async (transporter, mailOptions, maxRetries = 3) => {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId, attempt };
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt}/${maxRetries} failed for ${mailOptions.to}:`, error.message);
      
      // Jika bukan attempt terakhir, tunggu sebelum retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }
  }
  
  return { success: false, error: lastError.message, attempt: maxRetries };
};

// Helper function untuk delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function untuk format nomor WhatsApp (menghapus karakter non-digit dan menambahkan kode negara)
const formatWhatsAppNumber = (phone) => {
  if (!phone) return null;
  // Hapus semua karakter non-digit
  let cleaned = phone.replace(/\D/g, '');
  // Jika tidak dimulai dengan 62 (Indonesia), tambahkan 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
};

// Helper function untuk send WhatsApp message
const sendWhatsAppMessage = async (phoneNumber, message) => {
  const provider = process.env.WHATSAPP_PROVIDER || 'api'; // 'api', 'twilio', 'meta', 'custom'
  const formattedNumber = formatWhatsAppNumber(phoneNumber);
  
  if (!formattedNumber) {
    throw new Error('Nomor telepon tidak valid');
  }

  try {
    switch (provider) {
      case 'twilio':
        return await sendViaTwilio(formattedNumber, message);
      case 'meta':
        return await sendViaMeta(formattedNumber, message);
      case 'cloud':
        return await sendViaCloudAPI(formattedNumber, message);
      case 'custom':
        return await sendViaCustomAPI(formattedNumber, message);
      case 'api':
      default:
        return await sendViaGenericAPI(formattedNumber, message);
    }
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    throw error;
  }
};

// Send via Twilio
const sendViaTwilio = async (phoneNumber, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio configuration not found');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const data = new URLSearchParams({
    From: `whatsapp:${fromNumber}`,
    To: `whatsapp:${phoneNumber}`,
    Body: message
  });

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Twilio API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data.toString());
    req.end();
  });
};

// Send via Meta WhatsApp Business API
const sendViaMeta = async (phoneNumber, message) => {
  const apiUrl = process.env.META_WHATSAPP_API_URL;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!apiUrl || !accessToken || !phoneNumberId) {
    throw new Error('Meta WhatsApp configuration not found');
  }

  const url = `${apiUrl}/${phoneNumberId}/messages`;
  const data = JSON.stringify({
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'text',
    text: { body: message }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Meta API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Send via WhatsApp Cloud API (Recommended - lebih mudah setup)
const sendViaCloudAPI = async (phoneNumber, message) => {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_CLOUD_API_VERSION || 'v18.0';

  if (!accessToken || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API configuration not found. Pastikan WHATSAPP_CLOUD_ACCESS_TOKEN dan WHATSAPP_CLOUD_PHONE_NUMBER_ID sudah diisi.');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const data = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    type: 'text',
    text: {
      preview_url: false, // Set true jika ingin enable link preview
      body: message
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(body);
            resolve(result);
          } catch (e) {
            resolve({ success: true, raw: body });
          }
        } else {
          try {
            const errorData = JSON.parse(body);
            const errorMsg = errorData.error?.message || errorData.error?.error_user_msg || body;
            reject(new Error(`WhatsApp Cloud API error: ${res.statusCode} - ${errorMsg}`));
          } catch {
            reject(new Error(`WhatsApp Cloud API error: ${res.statusCode} - ${body}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Send via Custom API (generic HTTP API)
const sendViaCustomAPI = async (phoneNumber, message) => {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('WhatsApp API configuration not found');
  }

  const data = JSON.stringify({
    phone: phoneNumber,
    message: message,
    ...(process.env.WHATSAPP_API_EXTRA_PARAMS ? JSON.parse(process.env.WHATSAPP_API_EXTRA_PARAMS) : {})
  });

  const url = new URL(apiUrl);
  const isHttps = url.protocol === 'https:';

  return new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ success: true });
          }
        } else {
          reject(new Error(`API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

// Send via Generic API (fallback - menggunakan WhatsApp Web API atau service lain)
const sendViaGenericAPI = async (phoneNumber, message) => {
  // Fallback: buka WhatsApp Web dengan format URL
  // Ini akan membuka WhatsApp Web di browser, bukan mengirim otomatis
  // Untuk production, gunakan provider yang proper (Twilio, Meta, dll)
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  
  return {
    success: true,
    url: whatsappUrl,
    message: 'WhatsApp URL generated. Please configure a proper WhatsApp provider for automatic sending.',
    note: 'Untuk mengirim otomatis, konfigurasi WhatsApp provider (Twilio, Meta, dll) di environment variables'
  };
};

// GET /api/customers/email-quota - Get email quota status
exports.getEmailQuota = async (req, res) => {
  try {
    const quota = await getOrCreateDailyQuota();
    const DAILY_QUOTA_LIMIT = 400;
    
    res.json({
      count: quota.count,
      limit: DAILY_QUOTA_LIMIT,
      remaining: DAILY_QUOTA_LIMIT - quota.count,
      date: quota.date
    });
  } catch (error) {
    console.error('Error getting email quota:', error);
    res.status(500).json({ 
      error: 'Gagal mengambil data kuota email', 
      details: error.message 
    });
  }
};

// POST /api/customers/bulk-send-email
exports.bulkSendEmail = async (req, res) => {
  const { customerIds, subject, message } = req.body;
  const DAILY_QUOTA_LIMIT = 400;
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_EMAILS = 500; // 500ms

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 pelanggan yang dipilih' });
  }
  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'Subject email harus diisi' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan email harus diisi' });
  }

  const transporter = createTransporter();
  if (!transporter) {
    return res.status(503).json({ 
      error: 'Email service tidak dikonfigurasi. Silakan hubungi administrator untuk mengatur SMTP settings.' 
    });
  }

  try {
    // Cek kuota harian
    const quota = await getOrCreateDailyQuota();
    const remainingQuota = DAILY_QUOTA_LIMIT - quota.count;

    if (remainingQuota <= 0) {
      return res.status(429).json({ 
        error: `Kuota email harian sudah habis (${DAILY_QUOTA_LIMIT} email/hari). Silakan coba lagi besok.`,
        quotaUsed: quota.count,
        quotaLimit: DAILY_QUOTA_LIMIT
      });
    }

    // Ambil semua customer yang dipilih
    const customers = await prisma.customer.findMany({
      where: {
        id: {
          in: customerIds
        }
      }
    });

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Tidak ada pelanggan yang ditemukan' });
    }

    // Filter customer yang punya email
    const customersWithEmail = customers.filter(c => c.email);
    const customersWithoutEmail = customers.filter(c => !c.email);

    if (customersWithEmail.length === 0) {
      return res.status(400).json({ 
        error: 'Tidak ada pelanggan yang memiliki alamat email' 
      });
    }

    // Batasi jumlah email sesuai kuota yang tersedia
    const emailsToSend = Math.min(customersWithEmail.length, remainingQuota);
    const customersToEmail = customersWithEmail.slice(0, emailsToSend);
    const customersQuotaExceeded = customersWithEmail.slice(emailsToSend);

    // Kirim email dengan batch processing
    const results = {
      success: [],
      failed: [],
    };

    // Process dalam batch
    for (let i = 0; i < customersToEmail.length; i += BATCH_SIZE) {
      const batch = customersToEmail.slice(i, i + BATCH_SIZE);
      
      // Process batch
      for (const customer of batch) {
        const mailOptions = {
          from: `"${process.env.SMTP_FROM_NAME || 'Toko'}" <${process.env.SMTP_USER}>`,
          to: customer.email,
          subject: subject.trim(),
          html: message.trim().replace(/\n/g, '<br>'),
          text: message.trim(),
        };

        const result = await sendEmailWithRetry(transporter, mailOptions);
        
        if (result.success) {
          await incrementQuota(1);
          results.success.push({
            customerId: customer.id,
            customerName: customer.name,
            email: customer.email,
            messageId: result.messageId,
            attempt: result.attempt,
          });
          console.log(`Email sent to ${customer.email} (attempt ${result.attempt}):`, result.messageId);
        } else {
          results.failed.push({
            customerId: customer.id,
            customerName: customer.name,
            email: customer.email,
            error: result.error,
            attempts: result.attempt,
          });
          console.error(`Failed to send email to ${customer.email} after ${result.attempt} attempts:`, result.error);
        }

        // Delay antar email (kecuali email terakhir dalam batch)
        if (i + batch.indexOf(customer) < customersToEmail.length - 1) {
          await delay(DELAY_BETWEEN_EMAILS);
        }
      }

      // Delay antar batch (kecuali batch terakhir)
      if (i + BATCH_SIZE < customersToEmail.length) {
        await delay(DELAY_BETWEEN_EMAILS);
      }
    }

    // Update quota final
    const finalQuota = await getOrCreateDailyQuota();

    // Berikan response dengan summary
    const response = {
      message: `Email berhasil dikirim ke ${results.success.length} dari ${customersToEmail.length} pelanggan`,
      totalSelected: customers.length,
      totalWithEmail: customersWithEmail.length,
      totalWithoutEmail: customersWithoutEmail.length,
      emailsSent: results.success.length,
      emailsFailed: results.failed.length,
      quotaUsed: finalQuota.count,
      quotaLimit: DAILY_QUOTA_LIMIT,
      quotaRemaining: DAILY_QUOTA_LIMIT - finalQuota.count,
      success: results.success,
      failed: results.failed,
      skipped: [
        ...customersWithoutEmail.map(c => ({
          customerId: c.id,
          customerName: c.name,
          reason: 'Tidak memiliki alamat email'
        })),
        ...customersQuotaExceeded.map(c => ({
          customerId: c.id,
          customerName: c.name,
          email: c.email,
          reason: 'Kuota harian sudah habis'
        }))
      ]
    };

    // Jika ada yang gagal atau ada yang di-skip karena quota, return status 207 (Multi-Status)
    if (results.failed.length > 0 || customersQuotaExceeded.length > 0) {
      return res.status(207).json(response);
    }

    res.json(response);
  } catch (error) {
    console.error('Error in bulkSendEmail:', error);
    res.status(500).json({ 
      error: 'Gagal mengirim email', 
      details: error.message 
    });
  }
};

// POST /api/customers/:id/send-whatsapp
exports.sendWhatsApp = async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan WhatsApp harus diisi' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { id } });
    
    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    if (!customer.phone) {
      return res.status(400).json({ error: 'Pelanggan tidak memiliki nomor telepon' });
    }

    const result = await sendWhatsAppMessage(customer.phone, message.trim());
    
    res.json({
      message: 'Pesan WhatsApp berhasil dikirim',
      to: customer.phone,
      formattedNumber: formatWhatsAppNumber(customer.phone),
      result: result
    });
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    
    let errorMessage = 'Gagal mengirim pesan WhatsApp';
    if (error.message.includes('configuration not found')) {
      errorMessage = 'WhatsApp service tidak dikonfigurasi. Silakan hubungi administrator untuk mengatur WhatsApp provider.';
    } else if (error.message.includes('tidak valid')) {
      errorMessage = error.message;
    } else {
      errorMessage = error.message || 'Gagal mengirim pesan WhatsApp';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// POST /api/customers/bulk-send-whatsapp
exports.bulkSendWhatsApp = async (req, res) => {
  const { customerIds, message } = req.body;
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_MESSAGES = 1000; // 1 second untuk WhatsApp

  if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: 'Minimal harus ada 1 pelanggan yang dipilih' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Pesan WhatsApp harus diisi' });
  }

  try {
    // Ambil semua customer yang dipilih
    const customers = await prisma.customer.findMany({
      where: {
        id: {
          in: customerIds
        }
      }
    });

    if (customers.length === 0) {
      return res.status(404).json({ error: 'Tidak ada pelanggan yang ditemukan' });
    }

    // Filter customer yang punya nomor telepon
    const customersWithPhone = customers.filter(c => c.phone);
    const customersWithoutPhone = customers.filter(c => !c.phone);

    if (customersWithPhone.length === 0) {
      return res.status(400).json({ 
        error: 'Tidak ada pelanggan yang memiliki nomor telepon' 
      });
    }

    // Kirim WhatsApp dengan batch processing
    const results = {
      success: [],
      failed: [],
    };

    // Process dalam batch
    for (let i = 0; i < customersWithPhone.length; i += BATCH_SIZE) {
      const batch = customersWithPhone.slice(i, i + BATCH_SIZE);
      
      // Process batch
      for (const customer of batch) {
        try {
          const result = await sendWhatsAppMessage(customer.phone, message.trim());
          
          results.success.push({
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            formattedNumber: formatWhatsAppNumber(customer.phone),
            result: result
          });
          
          console.log(`WhatsApp sent to ${customer.phone}:`, result);
        } catch (error) {
          console.error(`Failed to send WhatsApp to ${customer.phone}:`, error);
          results.failed.push({
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            error: error.message,
          });
        }

        // Delay antar pesan (kecuali pesan terakhir dalam batch)
        if (i + batch.indexOf(customer) < customersWithPhone.length - 1) {
          await delay(DELAY_BETWEEN_MESSAGES);
        }
      }

      // Delay antar batch (kecuali batch terakhir)
      if (i + BATCH_SIZE < customersWithPhone.length) {
        await delay(DELAY_BETWEEN_MESSAGES);
      }
    }

    // Berikan response dengan summary
    const response = {
      message: `Pesan WhatsApp berhasil dikirim ke ${results.success.length} dari ${customersWithPhone.length} pelanggan`,
      totalSelected: customers.length,
      totalWithPhone: customersWithPhone.length,
      totalWithoutPhone: customersWithoutPhone.length,
      messagesSent: results.success.length,
      messagesFailed: results.failed.length,
      success: results.success,
      failed: results.failed,
      skipped: customersWithoutPhone.map(c => ({
        customerId: c.id,
        customerName: c.name,
        reason: 'Tidak memiliki nomor telepon'
      }))
    };

    // Jika ada yang gagal, return status 207 (Multi-Status)
    if (results.failed.length > 0) {
      return res.status(207).json(response);
    }

    res.json(response);
  } catch (error) {
    console.error('Error in bulkSendWhatsApp:', error);
    res.status(500).json({ 
      error: 'Gagal mengirim pesan WhatsApp', 
      details: error.message 
    });
  }
};