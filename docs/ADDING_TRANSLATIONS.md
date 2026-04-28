# دليل إضافة الترجمات للصفحات - Adding Translations Guide

## نظرة عامة
هذا الدليل يشرح كيفية إضافة الترجمات للصفحات الجديدة أو الصفحات الموجودة التي لم يتم ترجمتها بعد.

## الخطوات

### 1. إضافة مفاتيح الترجمة إلى `lib/i18n.ts`

#### أ) أضف المفاتيح إلى Interface
```typescript
export interface Translations {
  // ... existing
  myPage: {
    title: string;
    description: string;
    buttonText: string;
    // ... more keys
  };
}
```

#### ب) أضف الترجمات الإنجليزية
```typescript
en: {
  // ... existing
  myPage: {
    title: 'My Page',
    description: 'Page description',
    buttonText: 'Click Me',
  },
}
```

#### ج) أضف الترجمات العربية
```typescript
ar: {
  // ... existing
  myPage: {
    title: 'صفحتي',
    description: 'وصف الصفحة',
    buttonText: 'اضغط هنا',
  },
}
```

### 2. استخدام الترجمات في الصفحة

```tsx
'use client';

import { useTranslation } from '@/hooks/use-translation';

export default function MyPage() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t.myPage.title}</h1>
      <p>{t.myPage.description}</p>
      <Button>{t.myPage.buttonText}</Button>
    </div>
  );
}
```

## أمثلة من الصفحات المترجمة

### ✅ صفحات مترجمة بالكامل:
- **Sidebar** (`components/Sidebar.tsx`) - جميع عناصر القائمة
- **Header** (`components/Header.tsx`) - العنوان وأزرار تسجيل الخروج
- **Login Page** (`app/login/page.tsx`) - جميع النصوص
- **Users Page** (`app/(dashboard)/admin/users/page.tsx`) - جميع النصوص
- **Dashboard** (`app/(dashboard)/dashboard/page.tsx`) - جميع KPIs والنصوص
- **Account Page** (`app/(dashboard)/account/page.tsx`) - جميع النصوص
- **OPD Home** (`app/(dashboard)/opd/home/page.tsx`) - جميع النصوص

### 🔄 صفحات تحتاج ترجمة:
- صفحات Patient Experience
- صفحات ER (Register, Triage, Disposition, Progress Note)
- صفحات Equipment
- صفحات IPD
- صفحات Scheduling
- صفحات Policy System
- صفحات Notifications
- وغيرها...

## نصائح سريعة

1. **استخدم `t.common.*`** للأزرار الشائعة (حفظ، إلغاء، حذف، إلخ)
2. **استخدم `t.nav.*`** لعناوين القائمة
3. **استخدم `t.roles.*`** للأدوار
4. **أضف مفاتيح جديدة** في `lib/i18n.ts` للصفحات الجديدة

## مثال كامل

```tsx
'use client';

import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MyNewPage() {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.myPage.title}</h1>
        <p className="text-muted-foreground">{t.myPage.description}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{t.myPage.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>{t.common.save}</Button>
          <Button variant="outline">{t.common.cancel}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## ملاحظات مهمة

- **لا تكتب نصوص hardcoded** - استخدم دائماً `t.*`
- **أضف الترجمات للعربية والإنجليزية** معاً
- **اختبر الصفحة** في كلا اللغتين
- **استخدم المفاتيح الموجودة** من `t.common.*` و `t.nav.*` عندما يكون ذلك ممكناً

