# CVision Debug Banner

## الحالة الافتراضية
الـ Debug Banner **مخفي افتراضياً** في جميع الصفحات.

## كيفية إظهاره (للتطوير فقط)

إذا أردت إظهار الـ Debug Banner للتصحيح:

1. افتح Developer Console في المتصفح (F12)
2. اكتب في Console:
   ```javascript
   localStorage.setItem('cvision_debug_banner_hidden', 'false')
   ```
3. أعد تحميل الصفحة

## كيفية إخفاؤه

إذا ظهر الـ Banner وترغب في إخفائه:

1. اضغط على زر X في أعلى يمين الـ Banner
   - أو
2. اكتب في Console:
   ```javascript
   localStorage.setItem('cvision_debug_banner_hidden', 'true')
   ```
3. أعد تحميل الصفحة

## حذف الإعدادات

لحذف جميع إعدادات الـ Debug Banner:
```javascript
localStorage.removeItem('cvision_debug_banner_hidden')
```

## ملاحظات

- الـ Banner يظهر فقط في بيئة التطوير (`NODE_ENV !== 'production'`)
- الـ Banner مخفي افتراضياً حتى في بيئة التطوير
- يجب تفعيله يدوياً عبر `localStorage` عند الحاجة
