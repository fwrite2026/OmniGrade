import { AnswerSheetTemplate, SchoolClass, Student, Exam, ExamSubmission, UserAccount } from '../types';
import { createDefaultTemplate } from './templateGenerator';

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'usr_taminhkhoi',
    username: 'taminhkhoi',
    email: 'taminhkhoifpt@gmail.com',
    password: '123',
    fullName: 'Tạ Minh Khôi',
    role: 'admin',
    createdAt: '2025-01-01T08:00:00.000Z',
    status: 'active',
    department: 'FPT SCHOOLS / Ban Giám Hiệu',
    phone: '0901234567',
    notes: 'Tài khoản Quản trị viên Tạ Minh Khôi (FPT SCHOOLS)'
  },
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
  'tpl_120_fpt',
  'Phiếu 120 câu - FPT SCHOOLS',
  120,
  4,
  'FPT SCHOOLS',
  4
);

export const DEFAULT_40_KHOI_TEMPLATE: AnswerSheetTemplate = {
  ...createDefaultTemplate(
    'tpl_40_taminhkhoi',
    'Phiếu 40 câu - FPT SCHOOLS (Tạ Minh Khôi)',
    40,
    4,
    'FPT SCHOOLS',
    2
  ),
  createdBy: 'Tạ Minh Khôi',
  isSystemDefault: true
};

export const DEFAULT_50_KHOI_TEMPLATE: AnswerSheetTemplate = {
  ...createDefaultTemplate(
    'tpl_50_taminhkhoi',
    'Phiếu 50 câu - FPT SCHOOLS (Tạ Minh Khôi)',
    50,
    4,
    'FPT SCHOOLS',
    2
  ),
  createdBy: 'Tạ Minh Khôi',
  isSystemDefault: true
};

export const DEFAULT_100_KHOI_TEMPLATE: AnswerSheetTemplate = {
  ...createDefaultTemplate(
    'tpl_100_taminhkhoi',
    'Phiếu 100 câu - FPT SCHOOLS (Tạ Minh Khôi)',
    100,
    4,
    'FPT SCHOOLS',
    4
  ),
  createdBy: 'Tạ Minh Khôi',
  isSystemDefault: true
};

export const DEFAULT_120_KHOI_TEMPLATE: AnswerSheetTemplate = {
  ...createDefaultTemplate(
    'tpl_120_taminhkhoi',
    'Phiếu 120 câu - FPT SCHOOLS (Tạ Minh Khôi)',
    120,
    4,
    'FPT SCHOOLS',
    4
  ),
  createdBy: 'Tạ Minh Khôi',
  isSystemDefault: true
};

export const DEMO_CLASSES: SchoolClass[] = [];
export const DEMO_STUDENTS: Student[] = [];
export const DEMO_TEMPLATES: AnswerSheetTemplate[] = [
  DEFAULT_120_TEMPLATE,
  DEFAULT_40_KHOI_TEMPLATE,
  DEFAULT_50_KHOI_TEMPLATE,
  DEFAULT_100_KHOI_TEMPLATE,
  DEFAULT_120_KHOI_TEMPLATE
];
export const DEMO_EXAMS: Exam[] = [];
export const DEMO_SUBMISSIONS: ExamSubmission[] = [];
export const DEMO_EXAM: Exam | null = null;

