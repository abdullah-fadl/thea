# PHASE4_5_PLAN.md — خطة تنفيذ المرحلتين الرابعة والخامسة

---

## الخطوة 1: Dark Mode

```
نفذ الخطوة 1 من CLAUDE_PHASE4_5.md:

1. أنشئ ThemeProvider + useTheme hook
2. فعّل darkMode: 'class' في Tailwind
3. أضف dark: variants لكل الـ components (Header, Sidebar, Cards, Tables, Forms, Login, Dashboard)
4. أضف زر تبديل الثيم في الـ Header
5. تأكد yarn typecheck يمر
```

---

## الخطوة 2: Responsive Design

```
نفذ الخطوة 2 من CLAUDE_PHASE4_5.md:

1. أضف horizontal scroll للجداول على الجوال
2. خلي الـ Sidebar collapsible على الجوال
3. خلي الـ Forms تتراص عمودي على الجوال
4. خلي الـ Cards full-width على الجوال
5. تأكد yarn typecheck يمر
```

---

## الخطوة 3: تنظيف الكود + تقسيم الملفات الكبيرة

```
نفذ الخطوات 3 و 4 من CLAUDE_PHASE4_5.md:

1. غيّر أسماء ملفات *New.tsx لأسماء نظيفة بدون New
2. احذف dead code وملفات ما تُستخدم
3. قسّم lib/i18n.ts لملفات حسب المجال
4. قسّم lib/permissions.ts لملفات حسب المجال
5. حدّث كل الـ imports
6. تأكد yarn typecheck يمر
```

---

## الخطوة 4: الاختبارات التلقائية

```
نفذ الخطوة 5 من CLAUDE_PHASE4_5.md:

1. ثبت vitest: yarn add -D vitest @testing-library/react @testing-library/jest-dom
2. أنشئ vitest.config.ts
3. اكتب اختبارات لـ:
   - OPD API routes (encounters, booking, nursing, doctor)
   - Validation schemas (valid + invalid data)
   - Business logic (visitType, deathGuard, cache)
4. أضف "test": "vitest" في package.json
5. أضف test step في ci.yml
6. الهدف: 50+ test على الأقل
7. تأكد yarn test:run يمر
```

---

## الخطوة 5: Accessibility

```
نفذ الخطوة 6 من CLAUDE_PHASE4_5.md:

1. أضف aria-labels لكل الأزرار والحقول والروابط
2. أضف keyboard navigation (Tab, Enter, Escape)
3. استخدم semantic HTML (main, nav, header, section)
4. أضف "Skip to content" link
5. تأكد yarn typecheck يمر
```

---

## الخطوة 6: تكميل الصيدلية والمختبر والأشعة

```
نفذ الخطوة 7 من CLAUDE_PHASE4_5.md:

1. Pharmacy: كمّل dispensing workflow + inventory + drug interactions
2. Lab: كمّل specimen collection + result entry + critical alerts
3. Radiology: كمّل worklist + report entry + study tracking
4. اقرأ الكود الموجود أولاً وحدد الناقص ثم كمّله
5. تأكد yarn typecheck يمر
```

---

# ✅ بعد كل الخطوات

```bash
# Dark mode
grep -rn "dark:" components/ app/ | wc -l  # > 100

# Tests
yarn test:run  # > 50 tests

# i18n split
test -d lib/i18n && echo "OK"

# permissions split
test -d lib/permissions && echo "OK"

# Accessibility
grep -rn "aria-label" components/ | wc -l  # > 50

# TypeScript
npx tsc --noEmit  # 0 errors

# Build
yarn build  # SUCCESS
```
