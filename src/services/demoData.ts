import { AnswerSheetTemplate, SchoolClass, Student, Exam, ExamSubmission, UserAccount } from '../types';
import { createDefaultTemplate } from './templateGenerator';

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    password: 'admin@123',
    fullName: 'Quản trị viên Hệ thống',
    role: 'admin',
    createdAt: '2025-01-01T08:00:00.000Z',
    status: 'active',
    department: 'Ban Giám Hiệu / CNTT',
    phone: '0901234567',
    notes: 'Tài khoản Quản trị cấp cao nhất của hệ thống'
  },
  {
    id: 'usr_teacher_01',
    username: 'giaovien01',
    password: '123',
    fullName: 'Thầy Nguyễn Văn An',
    role: 'teacher',
    createdAt: '2025-01-05T09:30:00.000Z',
    status: 'active',
    department: 'Tổ Toán - Tin',
    phone: '0912345678',
    notes: 'Giáo viên phụ trách khối 12'
  },
  {
    id: 'usr_teacher_02',
    username: 'giaovien02',
    password: '123',
    fullName: 'Cô Trần Thị Mai',
    role: 'teacher',
    createdAt: '2025-01-10T14:15:00.000Z',
    status: 'active',
    department: 'Tổ Ngoại Ngữ',
    phone: '0987654321',
    notes: 'Giáo viên Tiếng Anh'
  }
];

export const DEFAULT_120_TEMPLATE: AnswerSheetTemplate = createDefaultTemplate(
  'tpl_120_standard',
  'Phiếu Trắc Nghiệm 120 Câu (A-D)',
  120,
  4,
  'BỘ GIÁO DỤC & ĐÀO TẠO',
  4
);

export const DEMO_CLASSES: SchoolClass[] = [];
export const DEMO_STUDENTS: Student[] = [];
export const DEMO_TEMPLATES: AnswerSheetTemplate[] = [DEFAULT_120_TEMPLATE];
export const DEMO_EXAMS: Exam[] = [];
export const DEMO_SUBMISSIONS: ExamSubmission[] = [];
export const DEMO_EXAM: Exam | null = null;
