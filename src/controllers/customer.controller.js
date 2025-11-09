const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/customers/debt
exports.getCustomersWithDebt = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      where: {
        debt: {
          gt: 0, // gt = greater than
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data utang' });
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