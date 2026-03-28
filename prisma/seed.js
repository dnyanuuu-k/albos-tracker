const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      plan: 'enterprise',
      settings: JSON.stringify({
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
      }),
    },
  });

  const email = 'hr@albostechnologies.com';
  const password = 'ChangeMe@123';

  const existingUser = await prisma.user.findFirst({
    where: { email, orgId: org.id },
  });

  let adminUser = existingUser;
  if (!adminUser) {
    const passwordHash = await bcrypt.hash(password, 12);
    adminUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        orgId: org.id,
        employeeId: 'EMP001',
        designation: 'Super Administrator',
        employmentType: 'FULL_TIME',
        joinDate: new Date(),
        profileComplete: 100,
      },
    });
    console.log('Admin user created:', adminUser.email);
  } else {
    console.log('Admin user already exists:', adminUser.email);
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { ownerId: adminUser.id },
  });

  const deptId = 'default-dept';
  const department = await prisma.department.upsert({
    where: { id: deptId },
    update: {
      managerId: adminUser.id,
      orgId: org.id,
    },
    create: {
      id: deptId,
      orgId: org.id,
      name: 'Engineering',
      code: 'ENG',
      description: 'Engineering Department',
      managerId: adminUser.id,
    },
  });

  if (!adminUser.deptId) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { deptId: department.id },
    });
  }

  console.log('Seed complete.');
  console.log('Initial SUPER_ADMIN credentials (change immediately):');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log('Org Slug: demo-org');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

