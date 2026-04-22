# Translation Guide - دليل الترجمة

## Overview
This project now supports full Arabic and English translation. When the language is switched to Arabic, all UI elements, navigation, buttons, and labels are automatically translated.

## How It Works

### 1. Translation Files
All translations are stored in `lib/i18n.ts`:
- `translations.en` - English translations
- `translations.ar` - Arabic translations

### 2. Using Translations in Components

#### Basic Usage
```tsx
'use client';

import { useTranslation } from '@/hooks/use-translation';

export default function MyPage() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t.nav.dashboard}</h1>
      <Button>{t.common.save}</Button>
    </div>
  );
}
```

#### Using the translate function
```tsx
const { t, translate } = useTranslation();

// Direct access
const title = t.nav.dashboard;

// Using translate function for nested paths
const title = translate('nav.dashboard');
```

## Adding Translations for New Pages

### Step 1: Add Translation Keys to `lib/i18n.ts`

Add your new translation keys to the `Translations` interface and both language objects:

```typescript
// In lib/i18n.ts
export interface Translations {
  // ... existing keys
  myModule: {
    title: string;
    description: string;
    createButton: string;
    // ... more keys
  };
}

// Then add translations for both languages
export const translations: Record<Language, Translations> = {
  en: {
    // ... existing
    myModule: {
      title: 'My Module',
      description: 'Module description',
      createButton: 'Create New',
    },
  },
  ar: {
    // ... existing
    myModule: {
      title: 'الوحدة الخاصة بي',
      description: 'وصف الوحدة',
      createButton: 'إنشاء جديد',
    },
  },
};
```

### Step 2: Use Translations in Your Component

```tsx
'use client';

import { useTranslation } from '@/hooks/use-translation';

export default function MyModulePage() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t.myModule.title}</h1>
      <p>{t.myModule.description}</p>
      <Button>{t.myModule.createButton}</Button>
    </div>
  );
}
```

## Common Translation Keys

### Already Available Keys

#### Common Actions (`t.common.*`)
- `save`, `cancel`, `delete`, `edit`, `create`, `update`
- `search`, `filter`, `export`, `import`
- `loading`, `error`, `success`, `confirm`
- `close`, `back`, `next`, `previous`
- `submit`, `reset`, `select`, `selectAll`

#### Navigation (`t.nav.*`)
- All sidebar menu items are already translated
- Use `t.nav.dashboard`, `t.nav.users`, etc.

#### Header (`t.header.*`)
- `hospitalOS`, `logout`, `welcome`

#### Auth (`t.auth.*`)
- `login`, `logout`, `email`, `password`
- `signIn`, `signingIn`, `signInToAccess`
- `defaultCredentials`

#### Users (`t.users.*`)
- All user management related strings

#### Roles (`t.roles.*`)
- `admin`, `supervisor`, `staff`, `viewer`

## Best Practices

1. **Always use translations**: Never hardcode text strings in components
2. **Use descriptive keys**: Use clear, hierarchical keys (e.g., `users.createUser` not `create`)
3. **Keep keys organized**: Group related translations together
4. **Add both languages**: Always add translations for both Arabic and English
5. **Test both languages**: Always test your pages in both languages

## Example: Complete Page Translation

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
        <h1 className="text-3xl font-bold">{t.myModule.title}</h1>
        <p className="text-muted-foreground">{t.myModule.description}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{t.myModule.cardTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>{t.common.create}</Button>
          <Button variant="outline">{t.common.cancel}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## Adding New Translation Categories

When adding a new module or feature:

1. **Add to interface**: Add the new category to `Translations` interface
2. **Add English translations**: Add all English strings
3. **Add Arabic translations**: Add all Arabic strings
4. **Use in components**: Import and use `useTranslation` hook

## Notes

- Translations are **automatically applied** when language changes
- The system uses **cookie and localStorage** to persist language preference
- **Document direction (RTL/LTR)** is automatically managed
- **Sidebar position** automatically switches (left for English, right for Arabic)

## Current Translation Coverage

✅ **Fully Translated:**
- Sidebar navigation
- Header
- Login page
- User management page
- Common actions and buttons
- Roles

🔄 **To Be Translated (Add as needed):**
- Other dashboard pages
- Forms and inputs
- Error messages
- Success messages
- Tooltips and help text

