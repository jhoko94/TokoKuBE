const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const prisma = new PrismaClient();

// Helper untuk format tanggal
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

// Helper untuk format rupiah
const formatRupiah = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// GET /api/export/sales - Export laporan penjualan ke Excel
exports.exportSales = async (req, res) => {
  try {
    const { period = 'all', startDate, endDate } = req.query;
    
    // Hitung periode
    let dateFilter = {};
    const now = new Date();
    if (period === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { createdAt: { gte: startOfDay } };
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { gte: startOfWeek } };
    } else if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { createdAt: { gte: startOfMonth } };
    } else if (period === 'custom' && startDate && endDate) {
      dateFilter = {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        }
      };
    }

    // Ambil data transaksi
    const transactions = await prisma.transaction.findMany({
      where: {
        ...dateFilter,
        type: 'LUNAS',
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Buat workbook Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Penjualan');

    // Header
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'LAPORAN PENJUALAN';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = `Periode: ${period === 'all' ? 'Semua' : period === 'today' ? 'Hari Ini' : period === 'week' ? '7 Hari Terakhir' : period === 'month' ? 'Bulan Ini' : `${startDate} - ${endDate}`}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:F3');
    worksheet.getCell('A3').value = `Tanggal Export: ${formatDate(new Date())}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Table headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
      'No',
      'Tanggal',
      'Invoice',
      'Pelanggan',
      'Total',
      'Item'
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data rows
    let totalSales = 0;
    transactions.forEach((tx, index) => {
      const row = worksheet.addRow([
        index + 1,
        formatDate(tx.createdAt),
        tx.invoiceNumber,
        tx.customer.name,
        Number(tx.total),
        tx.items.length
      ]);
      totalSales += Number(tx.total);
      
      // Format angka
      row.getCell(5).numFmt = '#,##0';
    });

    // Total row
    worksheet.addRow([]);
    const totalRow = worksheet.addRow(['', '', '', 'TOTAL', totalSales, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(5).numFmt = '#,##0';
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE0E0' }
    };

    // Set column widths
    worksheet.columns = [
      { width: 8 },
      { width: 15 },
      { width: 20 },
      { width: 25 },
      { width: 15 },
      { width: 10 },
    ];

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=laporan-penjualan-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Gagal export laporan penjualan', details: error.message });
  }
};

// GET /api/export/products - Export master barang ke Excel
exports.exportProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        distributor: true,
        units: true,
      },
      orderBy: { name: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Master Barang');

    // Header
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = 'MASTER BARANG';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `Tanggal Export: ${formatDate(new Date())}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Table headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
      'SKU',
      'Nama Barang',
      'Supplier',
      'Stok',
      'Min Stok',
      'Satuan',
      'Harga'
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Data rows
    products.forEach((product) => {
      if (product.units.length > 0) {
        product.units.forEach((unit, unitIndex) => {
          worksheet.addRow([
            unitIndex === 0 ? product.sku : '',
            unitIndex === 0 ? product.name : '',
            unitIndex === 0 ? (product.distributor?.name || '-') : '',
            unitIndex === 0 ? product.stock : '',
            unitIndex === 0 ? product.minStock : '',
            unit.name,
            Number(unit.price)
          ]);
          
          // Format angka
          const row = worksheet.lastRow;
          if (unitIndex === 0) {
            row.getCell(4).numFmt = '#,##0';
            row.getCell(5).numFmt = '#,##0';
          }
          row.getCell(7).numFmt = '#,##0';
        });
      } else {
        worksheet.addRow([
          product.sku,
          product.name,
          product.distributor?.name || '-',
          product.stock,
          product.minStock,
          '-',
          0
        ]);
      }
    });

    // Set column widths
    worksheet.columns = [
      { width: 15 },
      { width: 30 },
      { width: 25 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
    ];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=master-barang-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Gagal export master barang', details: error.message });
  }
};

// GET /api/export/debt - Export laporan piutang/hutang ke Excel
exports.exportDebt = async (req, res) => {
  try {
    const { type = 'customer' } = req.query; // 'customer' or 'supplier'

    const workbook = new ExcelJS.Workbook();
    
    if (type === 'customer') {
      const customers = await prisma.customer.findMany({
        where: {
          debt: { gt: 0 }
        },
        orderBy: { debt: 'desc' },
      });

      const worksheet = workbook.addWorksheet('Piutang Pelanggan');

      worksheet.mergeCells('A1:D1');
      worksheet.getCell('A1').value = 'LAPORAN PIUTANG PELANGGAN';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:D2');
      worksheet.getCell('A2').value = `Tanggal Export: ${formatDate(new Date())}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);
      const headerRow = worksheet.addRow(['No', 'Nama Pelanggan', 'Tipe', 'Total Piutang']);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      let totalDebt = 0;
      customers.forEach((customer, index) => {
        worksheet.addRow([
          index + 1,
          customer.name,
          customer.type,
          Number(customer.debt)
        ]);
        totalDebt += Number(customer.debt);
      });

      worksheet.addRow([]);
      const totalRow = worksheet.addRow(['', '', 'TOTAL', totalDebt]);
      totalRow.font = { bold: true };
      totalRow.getCell(4).numFmt = '#,##0';

      worksheet.columns = [
        { width: 8 },
        { width: 30 },
        { width: 15 },
        { width: 20 },
      ];

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=piutang-pelanggan-${Date.now()}.xlsx`
      );
    } else {
      const distributors = await prisma.distributor.findMany({
        where: {
          debt: { gt: 0 }
        },
        orderBy: { debt: 'desc' },
      });

      const worksheet = workbook.addWorksheet('Hutang Supplier');

      worksheet.mergeCells('A1:C1');
      worksheet.getCell('A1').value = 'LAPORAN HUTANG SUPPLIER';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:C2');
      worksheet.getCell('A2').value = `Tanggal Export: ${formatDate(new Date())}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);
      const headerRow = worksheet.addRow(['No', 'Nama Supplier', 'Total Hutang']);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      let totalDebt = 0;
      distributors.forEach((distributor, index) => {
        worksheet.addRow([
          index + 1,
          distributor.name,
          Number(distributor.debt)
        ]);
        totalDebt += Number(distributor.debt);
      });

      worksheet.addRow([]);
      const totalRow = worksheet.addRow(['', 'TOTAL', totalDebt]);
      totalRow.font = { bold: true };
      totalRow.getCell(3).numFmt = '#,##0';

      worksheet.columns = [
        { width: 8 },
        { width: 30 },
        { width: 20 },
      ];

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=hutang-supplier-${Date.now()}.xlsx`
      );
    }

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Gagal export laporan piutang/hutang', details: error.message });
  }
};

// GET /api/export/stock-history - Export kartu stok ke Excel
exports.exportStockHistory = async (req, res) => {
  try {
    const { productId } = req.query;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId harus diisi' });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        stockHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1000, // Limit untuk performa
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Kartu Stok');

    // Header
    worksheet.mergeCells('A1:G1');
    worksheet.getCell('A1').value = `KARTU STOK - ${product.name}`;
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:G2');
    worksheet.getCell('A2').value = `SKU: ${product.sku} | Stok Saat Ini: ${product.stock}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A3:G3');
    worksheet.getCell('A3').value = `Tanggal Export: ${formatDate(new Date())}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center' };

    // Table headers
    worksheet.addRow([]);
    const headerRow = worksheet.addRow([
      'No',
      'Tanggal',
      'Jenis',
      'Qty Sebelum',
      'Perubahan',
      'Qty Sesudah',
      'Keterangan'
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    product.stockHistory.forEach((history, index) => {
      worksheet.addRow([
        index + 1,
        formatDate(history.createdAt),
        history.type,
        history.qtyBefore,
        history.qtyChange > 0 ? `+${history.qtyChange}` : history.qtyChange,
        history.qtyAfter,
        history.note || '-'
      ]);
    });

    // Set column widths
    worksheet.columns = [
      { width: 8 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 40 },
    ];

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=kartu-stok-${product.sku}-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Gagal export kartu stok', details: error.message });
  }
};

