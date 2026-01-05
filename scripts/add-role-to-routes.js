const { addRoleToRoutes } = require('../src/utils/addRoleToRoutes');

// Ambil role baru dari command line argument
const newRole = process.argv[2];

if (!newRole) {
  console.error('❌ Error: Role baru harus diisi!');
  console.log('Usage: node scripts/add-role-to-routes.js <ROLE_NAME>');
  console.log('Example: node scripts/add-role-to-routes.js PROG');
  process.exit(1);
}

// Validasi format role (harus uppercase, alphanumeric, underscore)
const roleRegex = /^[A-Z0-9_]+$/;
if (!roleRegex.test(newRole)) {
  console.error('❌ Error: Format role tidak valid!');
  console.log('Role harus huruf besar, angka, atau underscore (contoh: PROG, ROLE_BARU)');
  process.exit(1);
}

console.log(`🚀 Menambahkan role "${newRole}" ke semua route...\n`);

// Gunakan fungsi helper
try {
  const result = addRoleToRoutes(newRole);
  
  console.log(`\n📊 Summary:`);
  console.log(`   - File diupdate: ${result.filesUpdated}`);
  console.log(`   - Total baris diupdate: ${result.linesUpdated}`);
  console.log(`\n✅ Selesai! Role "${newRole}" telah ditambahkan ke semua route.`);
  console.log(`\n⚠️  Catatan:`);
  console.log(`   - Backup file disimpan dengan ekstensi .backup`);
  console.log(`   - Restart server backend agar perubahan berlaku`);
  console.log(`   - Hapus file .backup setelah memastikan tidak ada masalah`);
} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
}
