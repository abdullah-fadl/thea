/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  plugins: ['boundaries'],
  settings: {
    // Phase 0 Gatekeeper: hard boundaries to prevent cross-imports between SAM and Health.
    // Only allowed shared surface is lib/shell/**.
    'boundaries/elements': [
      // Shell (shared) - ONLY auth/tenant/session/platform selector code should live here.
      { type: 'shell', pattern: 'lib/shell/*' },

      // SAM platform
      { type: 'sam_app', pattern: 'app/sam/*' },
      { type: 'sam_lib', pattern: 'lib/sam/*' },

      // Health platform
      { type: 'health_app', pattern: 'app/health/*' },
      { type: 'health_lib', pattern: 'lib/health/*' },
    ],
  },
  overrides: [
    // Disallow SAM importing Health (or any shared UI/components outside shell).
    {
      files: ['app/sam/**/*', 'lib/sam/**/*'],
      rules: {
        'boundaries/element-types': [
          'error',
          {
            default: 'allow',
            rules: [
              { from: ['sam_app', 'sam_lib'], allow: ['sam_app', 'sam_lib', 'shell'] },
            ],
          },
        ],
        // Prevent "shared components" outside shell (duplication is allowed per requirement).
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              // Prevent bypass via alias OR relative paths (e.g. ../../health/...)
              { group: ['@/lib/health/**', '@health/**', '@/app/health/**', '**/lib/health/**', '**/app/health/**'], message: 'SAM must not import Health modules.' },

              // No shared UI components: platforms must own their UI (duplication is allowed).
              { group: ['@/components/**', '@/components/*'], message: 'No shared UI components between platforms. Duplicate inside the platform.' },
            ],
          },
        ],
      },
    },

    // Disallow Health importing SAM (or any shared UI/components outside shell).
    {
      files: ['app/health/**/*', 'lib/health/**/*'],
      rules: {
        'boundaries/element-types': [
          'error',
          {
            default: 'allow',
            rules: [
              { from: ['health_app', 'health_lib'], allow: ['health_app', 'health_lib', 'shell'] },
            ],
          },
        ],
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              // Prevent bypass via alias OR relative paths (e.g. ../../sam/...)
              { group: ['@/lib/sam/**', '@sam/**', '@/app/sam/**', '**/lib/sam/**', '**/app/sam/**'], message: 'Health must not import SAM modules.' },

              // No shared UI components: platforms must own their UI (duplication is allowed).
              { group: ['@/components/**', '@/components/*'], message: 'No shared UI components between platforms. Duplicate inside the platform.' },
            ],
          },
        ],
      },
    },
  ],
};

