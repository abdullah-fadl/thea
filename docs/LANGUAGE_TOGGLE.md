# Language Toggle Component

## Overview
The Language Toggle button is now a core component that appears on all pages of the Thea application. It allows users to switch between Arabic (AR) and English (EN) languages.

## Implementation

### Automatic Inclusion
The Language Toggle is automatically included in:
- **All Dashboard Pages**: Via the `Header` component in `components/Header.tsx`
- **Login Page**: Directly added to `app/login/page.tsx`
- **All Pages using Layouts**: Any page using `(dashboard)/layout.tsx`, `opd/layout.tsx`, or `nursing/layout.tsx` will automatically have the toggle

### Component Location
- **Component**: `components/LanguageToggle.tsx`
- **Hook**: `hooks/use-lang.ts`
- **Provider**: `components/LanguageProvider.tsx`

## Usage in New Pages

### For Pages Using Dashboard Layout
If your page uses the dashboard layout (most pages), the Language Toggle is **automatically available** in the Header. No additional code needed.

```tsx
// Example: app/(dashboard)/my-new-page/page.tsx
export default function MyNewPage() {
  // Language toggle is already in the Header
  return <div>My Page Content</div>;
}
```

### For Standalone Pages (Without Layout)
If you create a page that doesn't use any layout, you can add the Language Toggle manually:

```tsx
'use client';

import { LanguageToggle } from '@/components/LanguageToggle';

export default function StandalonePage() {
  return (
    <div className="min-h-screen p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      {/* Your page content */}
    </div>
  );
}
```

### Using Language in Components
To use the language state in your components:

```tsx
'use client';

import { useLang } from '@/hooks/use-lang';

export function MyComponent() {
  const { language, dir, isRTL } = useLang();
  
  return (
    <div dir={dir}>
      {language === 'ar' ? 'مرحبا' : 'Hello'}
    </div>
  );
}
```

## Language State Management

The language preference is stored in:
- **Cookie**: `px-language` (expires in 1 year)
- **localStorage**: `px-language`

The language state is synchronized across:
- All tabs/windows of the same browser
- All components using the `useLang` hook
- Document direction (RTL/LTR) is automatically updated

## Best Practices

1. **Always use the Header**: For dashboard pages, use the Header component which includes the Language Toggle
2. **Use the hook**: When you need language-specific content, use `useLang()` hook
3. **Respect direction**: Use the `dir` property from `useLang()` for RTL/LTR support
4. **Test both languages**: Always test your pages in both Arabic and English

## Component API

### LanguageToggle Component
```tsx
<LanguageToggle />
```

**Props**: None (uses `useLang` hook internally)

**Features**:
- Shows current language (AR/EN)
- Toggles between Arabic and English
- Automatically updates document direction
- Scrolls to top on language change

### useLang Hook
```tsx
const { language, setLanguage, dir, isRTL } = useLang();
```

**Returns**:
- `language`: Current language ('ar' | 'en')
- `setLanguage`: Function to change language
- `dir`: Document direction ('rtl' | 'ltr')
- `isRTL`: Boolean indicating if RTL

## Notes

- The Language Toggle is a **core feature** and should be present on all pages
- The default language is **Arabic (ar)**
- Language preference persists across sessions
- Document direction is automatically managed

