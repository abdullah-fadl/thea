# ابدأ هنا — دليل سريع

## وش تحتاج قبل تبدأ

1. **Claude Code** — حمله من: https://docs.anthropic.com/en/docs/claude-code
2. **Node.js 20+** — حمله من: https://nodejs.org
3. **Docker Desktop** — حمله من: https://docker.com/products/docker-desktop
4. **Git** — حمله من: https://git-scm.com

---

## الخطوات

### 1. افتح المشروع في Terminal
```bash
cd /path/to/thea-ehr
```

### 2. حط ملف CLAUDE.md في جذر المشروع
انسخ ملف CLAUDE.md اللي عطيتك إياه وحطه في جذر المشروع.
هذا الملف يعلم Claude Code عن المشروع والقواعد.

### 3. شغل Claude Code
```bash
claude
```

### 4. ابدأ بالخطوة الأولى
انسخ هالنص وألصقه في Claude Code:

```
اقرأ CLAUDE.md ثم PHASE0_PLAN.md، وابدأ بتنفيذ الخطوة 1:
حذف ملفات Legacy Brand والـ Legacy
```

### 5. بعد ما يخلص، انتقل للخطوة الثانية
```
نفذ الخطوة 2 من PHASE0_PLAN.md: تنظيف Legacy Brand من Auth و Security
```

### 6. وهكذا... خطوة بخطوة
كل خطوة تعطيه الأمر وهو ينفذ. لو فشل، أعطيه الخطأ وهو يصلحه.

---

## نصائح مهمة

- **لا تحاول تسوي كل الخطوات مرة وحدة** — خذها خطوة بخطوة
- **بعد كل خطوة** جرب: `yarn typecheck` — لو فيه أخطاء أعطها Claude Code يصلحها
- **لو Claude Code تعلق**، قول: "توقف وأعطيني ملخص وش سويت ووش باقي"
- **احفظ نسخة** من المشروع قبل تبدأ (git commit أو نسخة من المجلد)

---

## الترتيب

| الخطوة | وش تقول لـ Claude Code | المتوقع |
|--------|------------------------|---------|
| 1 | "نفذ الخطوة 1: حذف Legacy Brand و Legacy" | يحذف ~55 ملف |
| 2 | "نفذ الخطوة 2: تنظيف Auth و Security" | يعدل ~6 ملفات |
| 3 | "نفذ الخطوة 3: تنظيف Middleware و APIs" | يعدل ~10 ملفات |
| 4 | "نفذ الخطوة 4: تنظيف UI Components" | يعدل ~10 ملفات |
| 5 | "نفذ الخطوة 5: تنظيف Scripts و Owner" | يعدل ~5 ملفات، 0 legacy brand |
| 6 | "نفذ الخطوة 6: PostgreSQL Schema" | ينشئ schema.prisma |
| 7 | "نفذ الخطوة 7: Repository Layer" | ينشئ ~6 ملفات جديدة |
| 8 | "نفذ الخطوة 8: تحويل API Routes" | يعدل 45 route |
| 9 | "نفذ الخطوة 9: Docker و ENV" | يعدل Docker + env |
