const INTENTS: Record<string, string[]> = {
  CHECK_LEAVE_BALANCE: ['رصيد إجازاتي', 'رصيد اجازاتي', 'كم باقي إجازة', 'كم باقي اجازة', 'leave balance', 'remaining leaves', 'رصيد الإجازات', 'رصيد الاجازات', 'اجازاتي', 'إجازاتي', 'كم إجازة', 'كم اجازة باقي'],
  CHECK_SALARY: ['راتبي', 'كم راتبي', 'my salary', 'payslip', 'كشف راتب', 'مسير الراتب', 'كشف الراتب', 'الراتب', 'salary', 'معاشي'],
  CHECK_LOAN: ['رصيد السلفة', 'قرضي', 'loan balance', 'سلفتي', 'القرض', 'السلفة', 'سلفة'],
  CHECK_ATTENDANCE: ['حضوري', 'تأخيراتي', 'my attendance', 'غيابي', 'الحضور', 'attendance', 'بصمة', 'بصمتي', 'تأخير'],
  CHECK_REQUEST_STATUS: ['حالة طلبي', 'وين وصل طلبي', 'request status', 'حالة الطلب', 'طلباتي', 'وش صار بطلبي', 'متابعة طلب'],
  REQUEST_LEAVE: ['أبي إجازة', 'ابي اجازة', 'طلب إجازة', 'طلب اجازة', 'request leave', 'take day off', 'أبغى إجازة', 'ابغى اجازة', 'اخذ اجازة', 'أخذ إجازة'],
  REQUEST_LETTER: ['أبي خطاب', 'ابي خطاب', 'تعريف بالراتب', 'salary certificate', 'request letter', 'خطاب تعريف', 'شهادة راتب', 'تعريف', 'خطاب', 'letter'],
  REQUEST_LOAN: ['أبي سلفة', 'ابي سلفة', 'request loan', 'طلب سلفة', 'طلب قرض', 'أبغى سلفة', 'ابغى سلفة'],
  COMPANY_POLICY: ['سياسة', 'policy', 'إجازة مرضية كم يوم', 'sick leave policy', 'نظام الشركة', 'سياسات', 'لوائح', 'اللوائح', 'النظام', 'القوانين'],
  HOLIDAY_INFO: ['إجازات رسمية', 'اجازات رسمية', 'holidays', 'عيد الفطر', 'اليوم الوطني', 'الاجازات الرسمية', 'الإجازات الرسمية', 'يوم التأسيس', 'عيد الاضحى', 'عيد الأضحى', 'إجازة رسمية', 'اجازة رسمية', 'العطل', 'عطلة'],
  HR_CONTACT: ['أبي أكلم HR', 'ابي اكلم', 'hr contact', 'مين مسؤول', 'رقم الموارد البشرية', 'الموارد البشرية', 'تواصل مع hr', 'رقم hr', 'ابي اكلم الموارد'],
  GREETING: ['مرحبا', 'مرحبًا', 'السلام عليكم', 'hello', 'hi', 'هلا', 'أهلاً', 'اهلا', 'كيف حالك', 'كيف الحال', 'هاي', 'صباح الخير', 'مساء الخير', 'سلام', 'hey', 'good morning', 'حياك', 'يعطيك العافية', 'الله يعافيك', 'كيفك', 'شخبارك', 'وش اخبارك'],
  HELP: ['مساعدة', 'وش تقدر تسوي', 'help', 'what can you do', 'وش تسوي', 'ايش تقدر', 'كيف استخدم', 'ساعدني', 'وش الخدمات', 'ايش الخدمات'],
};

/**
 * Normalize Arabic text for better matching:
 * - Remove "ال" prefix (definite article)
 * - Normalize hamza/alef variants
 * - Remove tatweel (kashida)
 */
function normalizeArabic(text: string): string {
  return text
    .replace(/\u0640/g, '')           // Remove tatweel ـ
    .replace(/[إأآا]/g, 'ا')          // Normalize alef variants
    .replace(/ة/g, 'ه')               // taa marbuta → haa
    .replace(/ى/g, 'ي')               // alef maqsura → yaa
    .trim();
}

export function detectIntent(message: string): string {
  const lower = message.toLowerCase().trim();
  const normalized = normalizeArabic(lower);

  for (const [intent, keywords] of Object.entries(INTENTS)) {
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const kwNorm = normalizeArabic(kwLower);
      // Match: exact substring OR normalized match
      if (lower.includes(kwLower) || normalized.includes(kwNorm)) return intent;
    }
  }
  return 'UNKNOWN';
}

export interface ChatResponse {
  text: string;
  quickActions?: { label: string; action: string }[];
  data?: any;
}

export async function processMessage(tenantId: string, employeeId: string, message: string, fetchFn?: (url: string) => Promise<any>): Promise<ChatResponse> {
  const intent = detectIntent(message);

  switch (intent) {
    case 'GREETING':
      return {
        text: 'أهلاً وسهلاً! 👋\nأنا المساعد الذكي لنظام CVision HR. كيف أقدر أساعدك؟',
        quickActions: [
          { label: '📋 رصيد الإجازات', action: 'CHECK_LEAVE_BALANCE' },
          { label: '📄 طلب خطاب', action: 'REQUEST_LETTER' },
          { label: '💰 راتبي', action: 'CHECK_SALARY' },
        ],
      };

    case 'HELP':
      return {
        text: 'أقدر أساعدك في:\n• 📋 رصيد الإجازات وطلب إجازة\n• 💰 معلومات الراتب\n• 📄 طلب خطاب تعريف\n• 💸 رصيد السلفة\n• 📊 حالة طلباتك\n• 📖 سياسات الشركة\n• 📅 الإجازات الرسمية\n\nاكتب سؤالك وأنا أساعدك! 😊',
        quickActions: [
          { label: '📋 رصيد إجازاتي', action: 'CHECK_LEAVE_BALANCE' },
          { label: '📄 طلب خطاب', action: 'REQUEST_LETTER' },
          { label: '📅 إجازات رسمية', action: 'HOLIDAY_INFO' },
        ],
      };

    case 'CHECK_LEAVE_BALANCE':
      return {
        text: 'جاري البحث عن رصيد إجازاتك... 🔍\nيمكنك مراجعة رصيدك التفصيلي من صفحة الإجازات.',
        quickActions: [
          { label: '📋 طلب إجازة', action: 'REQUEST_LEAVE' },
          { label: '📊 تفاصيل الإجازات', action: 'VIEW_LEAVES' },
        ],
      };

    case 'CHECK_SALARY':
      return {
        text: 'معلومات الراتب متاحة في صفحة الملف الشخصي > التعويضات. 💰\nللخصوصية، لا يتم عرض تفاصيل الراتب في المحادثة.',
        quickActions: [
          { label: '📄 تعريف بالراتب', action: 'REQUEST_LETTER' },
        ],
      };

    case 'REQUEST_LEAVE':
      return {
        text: '📋 لطلب إجازة، يرجى الانتقال لصفحة الإجازات واختيار "طلب إجازة جديد".\n\nستحتاج:\n• نوع الإجازة\n• تاريخ البداية والنهاية\n• السبب (اختياري)',
        quickActions: [
          { label: '📋 رصيد إجازاتي', action: 'CHECK_LEAVE_BALANCE' },
        ],
      };

    case 'REQUEST_LETTER':
      return {
        text: '📄 لطلب خطاب تعريف أو شهادة راتب:\n1. انتقل إلى صفحة الخطابات\n2. اختر نوع الخطاب\n3. قدّم الطلب\n\nعادةً يتم إصداره خلال 24 ساعة. ✅',
      };

    case 'REQUEST_LOAN':
      return {
        text: '💸 لطلب سلفة:\n1. انتقل إلى صفحة السلف\n2. حدد المبلغ وعدد الأقساط\n3. قدّم الطلب للموافقة\n\nالسلف تخضع لسياسة الشركة والموافقة الإدارية.',
      };

    case 'CHECK_LOAN':
      return {
        text: 'يمكنك مراجعة رصيد السلفة وتفاصيل الأقساط من صفحة السلف. 💸',
      };

    case 'CHECK_ATTENDANCE':
      return {
        text: 'سجل الحضور والانصراف متاح في صفحة الحضور. 🕐',
      };

    case 'CHECK_REQUEST_STATUS':
      return {
        text: 'يمكنك متابعة حالة جميع طلباتك من صفحة "طلباتي" في الخدمة الذاتية. 📊',
      };

    case 'COMPANY_POLICY':
      return {
        text: '📖 سياسات الشركة متاحة في قسم السياسات.\nيمكنك البحث عن أي سياسة محددة هناك.\n\nبعض المعلومات السريعة:\n• إجازة سنوية: 21-30 يوم حسب سنوات الخدمة\n• إجازة مرضية: حسب نظام العمل السعودي\n• إجازة زواج: 5 أيام',
      };

    case 'HOLIDAY_INFO':
      return {
        text: '📅 الإجازات الرسمية في المملكة:\n• عيد الفطر (إجازة رسمية)\n• عيد الأضحى (إجازة رسمية)\n• اليوم الوطني — 23 سبتمبر\n• يوم التأسيس — 22 فبراير\n\nللمزيد، راجع التقويم في النظام.',
      };

    case 'HR_CONTACT':
      return {
        text: 'للتواصل مع إدارة الموارد البشرية:\n📧 راجع دليل الموظفين في النظام\n📞 أو تواصل عبر قسم الشكاوى للحالات السرية',
      };

    default:
      return {
        text: 'آسف، ما قدرت أفهم طلبك بالضبط. 🤔\nتقدر تسألني عن:\n• رصيد الإجازات\n• طلب خطاب\n• سياسات الشركة\n• الإجازات الرسمية\n\nأو اكتب "مساعدة" لعرض كل الخدمات.',
        quickActions: [
          { label: '❓ مساعدة', action: 'HELP' },
          { label: '📋 رصيد إجازاتي', action: 'CHECK_LEAVE_BALANCE' },
          { label: '📄 طلب خطاب', action: 'REQUEST_LETTER' },
        ],
      };
  }
}
