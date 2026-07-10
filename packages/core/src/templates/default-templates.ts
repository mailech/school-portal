import { EmailType } from '@app/types';

export interface DefaultTemplate {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

const shell = (bodyInner: string) =>
  `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6">${bodyInner}<p style="margin-top:24px;color:#555">Regards,<br/>School Fees Office</p></div>`;

/** Seeded on first run; ADMIN can edit these in Settings. */
export const DEFAULT_TEMPLATES: Record<
  'PRE_DUE_REMINDER' | 'OVERDUE_NOTICE' | 'ESCALATION' | 'PAYMENT_RECEIVED',
  DefaultTemplate
> = {
  [EmailType.PRE_DUE_REMINDER]: {
    subject: 'Fee reminder: Installment {installmentNumber} for {studentName}',
    bodyText:
      'Dear {parentName},\n\nThis is a reminder that installment {installmentNumber} of {amount} for {studentName} ({className}) is due on {dueDate}.\n\nIf you have already paid, please reply to this email so we can update our records.\n\nRegards,\nSchool Fees Office',
    bodyHtml: shell(
      '<p>Dear {parentName},</p><p>This is a reminder that <strong>installment {installmentNumber}</strong> of <strong>{amount}</strong> for <strong>{studentName}</strong> ({className}) is due on <strong>{dueDate}</strong>.</p><p>If you have already paid, please reply to this email so we can update our records.</p>',
    ),
  },
  [EmailType.OVERDUE_NOTICE]: {
    subject: 'Overdue fee: Installment {installmentNumber} for {studentName}',
    bodyText:
      'Dear {parentName},\n\nInstallment {installmentNumber} of {amount} for {studentName} ({className}) was due on {dueDate} and is now overdue.\n\nPlease arrange payment at the earliest. If you have already paid, reply to this email with the details.\n\nRegards,\nSchool Fees Office',
    bodyHtml: shell(
      '<p>Dear {parentName},</p><p><strong>Installment {installmentNumber}</strong> of <strong>{amount}</strong> for <strong>{studentName}</strong> ({className}) was due on <strong>{dueDate}</strong> and is now <strong style="color:#b91c1c">overdue</strong>.</p><p>Please arrange payment at the earliest. If you have already paid, reply to this email with the details.</p>',
    ),
  },
  [EmailType.ESCALATION]: {
    subject: 'Urgent: Overdue fee for {studentName} — Installment {installmentNumber}',
    bodyText:
      'Dear {parentName},\n\nDespite our earlier notice, installment {installmentNumber} of {amount} for {studentName} ({className}), due on {dueDate}, remains unpaid.\n\nKindly clear the dues immediately to avoid further action. If payment has been made, please reply to this email.\n\nRegards,\nSchool Fees Office',
    bodyHtml: shell(
      '<p>Dear {parentName},</p><p>Despite our earlier notice, <strong>installment {installmentNumber}</strong> of <strong>{amount}</strong> for <strong>{studentName}</strong> ({className}), due on <strong>{dueDate}</strong>, remains unpaid.</p><p>Kindly clear the dues immediately to avoid further action. If payment has been made, please reply to this email.</p>',
    ),
  },
  [EmailType.PAYMENT_RECEIVED]: {
    subject: 'Payment received — thank you ({studentName}, installment {installmentNumber})',
    bodyText:
      'Dear {parentName},\n\nWe have received payment of {amount} for installment {installmentNumber} for {studentName} ({className}). Thank you.\n\nRegards,\nSchool Fees Office',
    bodyHtml: shell(
      '<p>Dear {parentName},</p><p>We have received payment of <strong>{amount}</strong> for <strong>installment {installmentNumber}</strong> for <strong>{studentName}</strong> ({className}). Thank you.</p>',
    ),
  },
};
