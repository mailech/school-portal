/* eslint-disable no-console */
import { hash } from '@node-rs/argon2';
import { DateTime } from 'luxon';
import { PrismaClient, Prisma } from '../generated/client';

const prisma = new PrismaClient();

const TZ = process.env.TZ_DEFAULT ?? 'Asia/Kolkata';
const today = DateTime.now().setZone(TZ).startOf('day');

const argonOpts = {
  memoryCost: Number(process.env.ARGON2_MEMORY_KIB ?? 19456),
  timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
  parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
};

function dec(n: number) {
  return new Prisma.Decimal(n.toFixed(2));
}

async function main() {
  console.log('Seeding database…');

  // --- Settings -------------------------------------------------------------
  await prisma.appSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      reminderOffsetDays: Number(process.env.REMINDER_OFFSET_DAYS ?? 10),
      overdueGraceDays: Number(process.env.OVERDUE_GRACE_DAYS ?? 0),
      escalationOffsetDays: Number(process.env.ESCALATION_OFFSET_DAYS ?? 10),
      timezone: TZ,
      currency: process.env.CURRENCY ?? 'INR',
      dailySweepCron: process.env.DAILY_SWEEP_CRON ?? '0 6 * * *',
    },
  });

  // --- Staff users ----------------------------------------------------------
  const adminHash = await hash(process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345', argonOpts);
  const accHash = await hash(process.env.SEED_ACCOUNTANT_PASSWORD ?? 'Account@12345', argonOpts);

  const admin = await prisma.user.upsert({
    where: { email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@school.test').toLowerCase() },
    update: { passwordHash: adminHash, role: 'ADMIN', isActive: true },
    create: {
      id: 'user-admin',
      name: 'School Administrator',
      email: (process.env.SEED_ADMIN_EMAIL ?? 'admin@school.test').toLowerCase(),
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: (process.env.SEED_ACCOUNTANT_EMAIL ?? 'accountant@school.test').toLowerCase() },
    update: { passwordHash: accHash, role: 'ACCOUNTANT', isActive: true },
    create: {
      id: 'user-accountant',
      name: 'Fees Accountant',
      email: (process.env.SEED_ACCOUNTANT_EMAIL ?? 'accountant@school.test').toLowerCase(),
      passwordHash: accHash,
      role: 'ACCOUNTANT',
    },
  });

  // --- Academic structure ---------------------------------------------------
  const ay = await prisma.academicYear.upsert({
    where: { label: '2026-27' },
    update: { isActive: true, timezone: TZ },
    create: { id: 'ay-2026-27', label: '2026-27', isActive: true, timezone: TZ },
  });

  const cls = await prisma.schoolClass.upsert({
    where: {
      academicYearId_name_section: { academicYearId: ay.id, name: 'Grade 5', section: 'A' },
    },
    update: {},
    create: { id: 'cls-grade5a', name: 'Grade 5', section: 'A', academicYearId: ay.id },
  });

  const fee = await prisma.feeStructure.upsert({
    where: { schoolClassId: cls.id },
    update: { totalAmount: dec(30000) },
    create: {
      id: 'fee-grade5a',
      schoolClassId: cls.id,
      academicYearId: ay.id,
      totalAmount: dec(30000),
    },
  });

  const instDates = [today.minus({ days: 20 }), today.plus({ days: 6 }), today.plus({ days: 70 })];
  const installments = [];
  for (let i = 0; i < 3; i++) {
    const inst = await prisma.installment.upsert({
      where: { feeStructureId_installmentNumber: { feeStructureId: fee.id, installmentNumber: i + 1 } },
      update: { amount: dec(10000), dueDate: instDates[i].toJSDate() },
      create: {
        id: `inst-${i + 1}`,
        feeStructureId: fee.id,
        installmentNumber: i + 1,
        amount: dec(10000),
        dueDate: instDates[i].toJSDate(),
      },
    });
    installments.push(inst);
  }

  // --- Students -------------------------------------------------------------
  const studentDefs = [
    { id: 'stu-aarav', name: 'Aarav Sharma', regId: 'G5A-001', parentName: 'Rohit Sharma', parentEmail: 'rohit.sharma@example.com', parentMobile: '9876500001' },
    { id: 'stu-diya', name: 'Diya Nair', regId: 'G5A-002', parentName: 'Anita Nair', parentEmail: 'anita.nair@example.com', parentMobile: '9876500002' },
    { id: 'stu-kabir', name: 'Kabir Verma', regId: 'G5A-003', parentName: 'Suresh Verma', parentEmail: 'suresh.verma@example.com', parentMobile: '9876500003' },
    { id: 'stu-meera', name: 'Meera Iyer', regId: 'G5A-004', parentName: 'Lakshmi Iyer', parentEmail: 'lakshmi.iyer@example.com', parentMobile: '9876500004' },
  ];

  const students = [];
  for (const s of studentDefs) {
    const student = await prisma.student.upsert({
      where: { regId: s.regId },
      update: { parentEmail: s.parentEmail },
      create: {
        id: s.id,
        name: s.name,
        regId: s.regId,
        schoolClassId: cls.id,
        academicYearId: ay.id,
        parentName: s.parentName,
        parentMobile: s.parentMobile,
        parentEmail: s.parentEmail,
      },
    });
    students.push(student);
  }
  const [aarav, diya, kabir, meera] = students;

  // --- Payment dues (one per student per installment) -----------------------
  // Default everything to UPCOMING with denormalized dueDate, then override.
  async function upsertDue(
    studentId: string,
    installmentIndex: number,
    data: Partial<Prisma.PaymentDueUncheckedCreateInput>,
  ) {
    const inst = installments[installmentIndex];
    const isPaid = data.status === 'PAID';
    return prisma.paymentDue.upsert({
      where: { studentId_installmentId: { studentId, installmentId: inst.id } },
      update: {
        status: (data.status as any) ?? undefined,
        paidAmount: isPaid ? (data.paidAmount ?? undefined) : null,
        paidAt: isPaid ? (data.paidAt ?? undefined) : null,
        markedPaidByUserId: isPaid ? (data.markedPaidByUserId ?? undefined) : null,
      },
      create: {
        studentId,
        installmentId: inst.id,
        amount: inst.amount,
        dueDate: inst.dueDate,
        status: 'UPCOMING',
        ...data,
      },
    });
  }

  // Baseline: every student gets 3 dues.
  for (const s of students) {
    for (let i = 0; i < 3; i++) await upsertDue(s.id, i, {});
  }

  // Aarav: inst1 PAID (green), inst2 REMINDED (blue), inst3 UPCOMING
  const aaravInst1 = await upsertDue(aarav.id, 0, {
    status: 'PAID',
    paidAmount: dec(10000),
    paidAt: today.minus({ days: 18 }).toJSDate(),
    markedPaidByUserId: admin.id,
  });
  const aaravInst2 = await upsertDue(aarav.id, 1, { status: 'REMINDED' });

  // Diya: inst1 OVERDUE (red)
  const diyaInst1 = await upsertDue(diya.id, 0, { status: 'OVERDUE' });

  // Kabir: inst1 UNDER_REVIEW (yellow) — a reply arrived
  const kabirInst1 = await upsertDue(kabir.id, 0, { status: 'UNDER_REVIEW' });

  // Meera: inst1 OVERDUE (red), inst2 REMINDED (blue)
  const meeraInst1 = await upsertDue(meera.id, 0, { status: 'OVERDUE' });
  await upsertDue(meera.id, 1, { status: 'REMINDED' });

  // --- Email logs (idempotent by id) ----------------------------------------
  async function upsertEmailLog(
    id: string,
    data: Omit<Prisma.EmailLogUncheckedCreateInput, 'id'>,
  ) {
    await prisma.emailLog.upsert({ where: { id }, update: {}, create: { id, ...data } });
  }

  await upsertEmailLog('el-aarav1-paid', {
    studentId: aarav.id,
    paymentDueId: aaravInst1.id,
    type: 'PAYMENT_RECEIVED',
    toEmail: aarav.parentEmail,
    subject: 'Payment received — thank you',
    status: 'SENT',
    providerMessageId: '<paid-aarav-inst1@school.test>',
    sentAt: today.minus({ days: 18 }).toJSDate(),
  });
  await upsertEmailLog('el-aarav2-reminder', {
    studentId: aarav.id,
    paymentDueId: aaravInst2.id,
    type: 'PRE_DUE_REMINDER',
    toEmail: aarav.parentEmail,
    subject: 'Fee reminder: Installment 2',
    status: 'SENT',
    providerMessageId: '<reminder-aarav-inst2@school.test>',
    sentAt: today.minus({ days: 1 }).toJSDate(),
  });
  await upsertEmailLog('el-diya1-overdue', {
    studentId: diya.id,
    paymentDueId: diyaInst1.id,
    type: 'OVERDUE_NOTICE',
    toEmail: diya.parentEmail,
    subject: 'Overdue fee: Installment 1',
    status: 'SENT',
    providerMessageId: '<overdue-diya-inst1@school.test>',
    sentAt: today.minus({ days: 5 }).toJSDate(),
  });
  await upsertEmailLog('el-meera1-overdue', {
    studentId: meera.id,
    paymentDueId: meeraInst1.id,
    type: 'OVERDUE_NOTICE',
    toEmail: meera.parentEmail,
    subject: 'Overdue fee: Installment 1',
    status: 'SENT',
    providerMessageId: '<overdue-meera-inst1@school.test>',
    sentAt: today.minus({ days: 5 }).toJSDate(),
  });
  // Kabir got a reminder (threading anchor) that his parent replied to.
  await upsertEmailLog('el-kabir1-reminder', {
    studentId: kabir.id,
    paymentDueId: kabirInst1.id,
    type: 'PRE_DUE_REMINDER',
    toEmail: kabir.parentEmail,
    subject: 'Fee reminder: Installment 1',
    status: 'SENT',
    providerMessageId: '<reminder-kabir-inst1@school.test>',
    sentAt: today.minus({ days: 12 }).toJSDate(),
  });
  await upsertEmailLog('el-kabir1-overdue', {
    studentId: kabir.id,
    paymentDueId: kabirInst1.id,
    type: 'OVERDUE_NOTICE',
    toEmail: kabir.parentEmail,
    subject: 'Overdue fee: Installment 1',
    status: 'SENT',
    providerMessageId: '<overdue-kabir-inst1@school.test>',
    sentAt: today.minus({ days: 5 }).toJSDate(),
  });

  // --- Incoming reply that flipped Kabir's due to yellow --------------------
  await prisma.incomingReply.upsert({
    where: { gmailMessageId: '<reply-kabir-1@parent>' },
    update: { classification: 'UNREVIEWED', reviewedByUserId: null, reviewedAt: null },
    create: {
      id: 'reply-kabir-1',
      studentId: kabir.id,
      paymentDueId: kabirInst1.id,
      fromEmail: kabir.parentEmail,
      subject: 'Re: Fee reminder: Installment 1',
      snippet: 'We have already paid installment 1 via UPI on 3rd July…',
      bodyText:
        'Dear Sir/Madam,\n\nWe have already paid installment 1 via UPI on 3rd July. Please find the transaction reference: UPI-8842019. Kindly update your records.\n\nThank you,\nSuresh Verma',
      gmailMessageId: '<reply-kabir-1@parent>',
      inReplyToMessageId: '<reminder-kabir-inst1@school.test>',
      referencesIds: ['<reminder-kabir-inst1@school.test>'],
      matchMethod: 'THREAD',
      classification: 'UNREVIEWED',
      receivedAt: today.minus({ days: 2 }).toJSDate(),
    },
  });

  console.log('Seed complete.');
  console.log('  Admin:      %s', process.env.SEED_ADMIN_EMAIL ?? 'admin@school.test');
  console.log('  Accountant: %s', process.env.SEED_ACCOUNTANT_EMAIL ?? 'accountant@school.test');
  console.log('  Board: 2 red, 1 yellow, 1 green, 2 reminded, rest upcoming.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
