const fs = require('fs');
const path = require('path');

/**
 * Menambahkan role baru ke semua route yang menggunakan authorize()
 * @param {string} newRole - Kode role baru (contoh: 'PROG', 'ROLE_BARU')
 * @returns {Object} - { success: boolean, filesUpdated: number, linesUpdated: number }
 */
function addRoleToRoutes(newRole) {
  // Validasi format role
  const roleRegex = /^[A-Z0-9_]+$/;
  if (!roleRegex.test(newRole)) {
    throw new Error('Format role tidak valid. Role harus huruf besar, angka, atau underscore');
  }

  const routesDir = path.join(__dirname, '../../src/routes');
  const routeFiles = [
    'product.routes.js',
    'customer.routes.js',
    'distributor.routes.js',
    'po.routes.js',
    'retur.routes.js',
    'report.routes.js',
    'warehouse.routes.js',
    'store.routes.js',
  ];

  let totalFilesUpdated = 0;
  let totalLinesUpdated = 0;

  routeFiles.forEach(fileName => {
    const filePath = path.join(routesDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let fileChanged = false;
    let linesChanged = 0;

    // Cari semua pattern authorize yang ada
    const authorizeRegex = /authorize\(([^)]+)\)/g;
    const matches = [...content.matchAll(authorizeRegex)];

    matches.forEach(match => {
      const fullMatch = match[0];
      const rolesString = match[1];
      
      // Parse roles dari string
      const roles = rolesString
        .split(',')
        .map(r => r.trim().replace(/['"]/g, ''))
        .filter(r => r.length > 0);

      // Skip jika role sudah ada
      if (roles.includes(newRole)) {
        return;
      }

      // Skip jika ini authorize('ADMIN') saja (untuk route yang hanya admin)
      if (roles.length === 1 && roles[0] === 'ADMIN') {
        return;
      }

      // Tambahkan role baru
      roles.push(newRole);
      
      // Buat string baru dengan role yang sudah diurutkan
      const sortedRoles = roles.sort();
      const newRolesString = sortedRoles.map(r => `'${r}'`).join(', ');
      const newAuthorize = `authorize(${newRolesString})`;
      
      // Replace di content (hanya replace yang pertama kali ditemukan untuk setiap match)
      content = content.replace(fullMatch, newAuthorize);
      fileChanged = true;
      linesChanged++;
    });

    if (fileChanged) {
      // Buat backup (hanya sekali)
      const backupPath = filePath + '.backup';
      if (!fs.existsSync(backupPath)) {
        fs.writeFileSync(backupPath, fs.readFileSync(filePath, 'utf8'));
      }
      
      // Tulis file baru
      fs.writeFileSync(filePath, content, 'utf8');
      
      totalFilesUpdated++;
      totalLinesUpdated += linesChanged;
    }
  });

  return {
    success: true,
    filesUpdated: totalFilesUpdated,
    linesUpdated: totalLinesUpdated
  };
}

module.exports = { addRoleToRoutes };

