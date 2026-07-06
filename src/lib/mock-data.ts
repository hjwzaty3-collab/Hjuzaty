import { UserRole } from "@/types";

export const SPECIALTIES = [
  { id: '1', name: 'أمراض القلب', icon: 'HeartPulse' },
  { id: '2', name: 'الأمراض الجلدية', icon: 'UserCircle' },
  { id: '3', name: 'طب الأطفال', icon: 'Baby' },
  { id: '4', name: 'جراحة المخ والأعصاب', icon: 'Brain' },
  { id: '5', name: 'جراحة العظام', icon: 'Activity' },
  { id: '6', name: 'طب العيون', icon: 'Eye' },
  { id: '7', name: 'طب الأسنان', icon: 'Stethoscope' },
  { id: '8', name: 'الطب النفسي', icon: 'Smile' },
];

export const DOCTORS = [
  {
    id: 'd1',
    name: 'د. سارة أحمد',
    specialization: 'أمراض القلب',
    price: 150000,
    rating: 4.8,
    reviews: 124,
    image: 'https://picsum.photos/seed/doctor1/200/200',
    locations: ['العيادة الرئيسية، الحارثية', 'بغداد، العراق'],
    availableTimes: ['09:00 ص', '10:30 ص', '02:00 م', '04:30 م'],
    about: 'أخصائية في أمراض وجراحة القلب والأوعية الدموية مع أكثر من 15 عاماً من الخبرة في القسطرة العلاجية.',
  },
  {
    id: 'd2',
    name: 'د. خالد منصور',
    specialization: 'الأمراض الجلدية',
    price: 120000,
    rating: 4.9,
    reviews: 89,
    image: 'https://picsum.photos/seed/doctor2/200/200',
    locations: ['مركز العناية بالبشرة، المنصور', 'بغداد، العراق'],
    availableTimes: ['08:00 ص', '11:00 ص', '01:00 م'],
    about: 'خبير في الأمراض الجلدية التجميلية وعلاجات سرطان الجلد المتقدمة.',
  },
  {
    id: 'd3',
    name: 'د. ليلى حسن',
    specialization: 'طب الأطفال',
    price: 100000,
    rating: 4.7,
    reviews: 210,
    image: 'https://picsum.photos/seed/doctor3/200/200',
    locations: ['صحة العائلة، شارع فلسطين', 'بغداد، العراق'],
    availableTimes: ['10:00 ص', '12:00 م', '03:00 م'],
    about: 'متفانية في تقديم أفضل رعاية للأطفال منذ الولادة وحتى المراهقة.',
  },
];

export const MEDICAL_RECORDS = [
  {
    id: 'r1',
    date: '2024-03-15',
    doctorName: 'Dr. Sarah Ahmed',
    diagnosis: 'Mild Hypertension',
    prescription: 'Lisinopril 10mg once daily',
    notes: 'Patient should monitor blood pressure daily and reduce salt intake.',
    nextVisit: '2024-06-15',
  },
  {
    id: 'r2',
    date: '2024-01-10',
    doctorName: 'Dr. Khalid Mansour',
    diagnosis: 'Seasonal Allergy',
    prescription: 'Claritin 10mg as needed',
    notes: 'Avoid outdoor activities during high pollen counts.',
    nextVisit: 'As needed',
  },
];

export const TRANSACTIONS = [
  { id: 't1', date: '2024-03-20', type: 'Payment', amount: -150, description: 'Appointment with Dr. Sarah Ahmed', status: 'Completed' },
  { id: 't2', date: '2024-03-18', type: 'Top-up', amount: 500, description: 'Wallet Top-up via Visa', status: 'Completed' },
  { id: 't3', date: '2024-02-05', type: 'Payment', amount: -120, description: 'Appointment with Dr. Khalid Mansour', status: 'Completed' },
];
