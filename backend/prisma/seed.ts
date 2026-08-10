import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Telemedicine database...');

  const doctor = await prisma.doctor.upsert({
    where: { email: 'dr.smith@telemed.com' },
    update: {},
    create: {
      email: 'dr.smith@telemed.com',
      fullName: 'Dr. Sarah Smith, MD',
      specialty: 'Cardiology',
      licenseNo: 'MD-9918237-NY',
    },
  });

  const patient = await prisma.patient.upsert({
    where: { email: 'patient.john@gmail.com' },
    update: {},
    create: {
      email: 'patient.john@gmail.com',
      fullName: 'John Doe',
      dateOfBirth: new Date('1988-05-14'),
    },
  });

  await prisma.appointment.create({
    data: {
      doctorId: doctor.id,
      patientId: patient.id,
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      videoRoomUrl: 'https://telemed.video/room-882391',
    },
  });

  console.log('Seeding complete for Telemedicine Platform.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
