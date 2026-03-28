import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default organization first
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

  console.log('✅ Organization created:', org.name);

  // Create admin user
  // Default seed password for local/dev only. Change immediately in any shared environment.
  const passwordHash = await hashPassword('ChangeMe!123');

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      email: 'admin@example.com',
      orgId: org.id,
    },
  });

  let adminUser;

  if (existingUser) {
    adminUser = existingUser;
    console.log('✅ Admin user already exists:', adminUser.email);
  } else {
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
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

    console.log('✅ Admin user created:', adminUser.email);
  }

  // Update organization owner
  await prisma.organization.update({
    where: { id: org.id },
    data: { ownerId: adminUser.id },
  });

  console.log('✅ Organization owner updated');

  // Create default department
  let department = await prisma.department.findUnique({
    where: { id: 'default-dept' },
  });

  if (!department) {
    department = await prisma.department.create({
      data: {
        id: 'default-dept',
        orgId: org.id,
        name: 'Engineering',
        code: 'ENG',
        description: 'Engineering Department',
        managerId: adminUser.id,
      },
    });

    console.log('✅ Department created:', department.name);
  } else {
    console.log('✅ Department already exists:', department.name);
  }

  // Update user's department if not set
  if (!adminUser.deptId) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { deptId: department.id },
    });

    console.log('✅ User linked to department');
  }

  console.log('🎉 Database seeded successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Email: admin@example.com');
  console.log('   Password: ChangeMe!123');
  console.log('   Org Slug: demo-org');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
