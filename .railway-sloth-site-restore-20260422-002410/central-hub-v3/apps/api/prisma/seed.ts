import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  
  if (userCount === 0) {
    const defaultPassword = process.env.DEFAULT_PASSWORD || 'central-hub-2025';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    await prisma.user.create({
      data: {
        password: hashedPassword
      }
    });
    
    console.log('✅ Default user created');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
