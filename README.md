node ver 22

npm install

# Ganti USER, PASSWORD, HOST, PORT, dan DATABASE sesuai pengaturan Anda
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Contoh:
# DATABASE_URL="postgresql://postgres:admin123@localhost:5432/tokodb?schema=public"

# Port untuk menjalankan server API
PORT=3001

npx prisma migrate dev
npx prisma db seed
npm run dev

