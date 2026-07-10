import type { StudentView } from './student';
import type { DueDetailView } from './due';
import type { EmailLogView } from './email';
import type { ReplyView } from './reply';

export interface StudentDetailView {
  student: StudentView;
  academicYearLabel: string;
  totalAmount: number | null;
  paidAmount: number;
  outstandingAmount: number;
  dues: DueDetailView[];
  emails: EmailLogView[];
  replies: ReplyView[];
}

export interface DueActionResult {
  dueId: string;
  status: string;
}
