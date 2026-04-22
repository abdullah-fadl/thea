# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e4]:
    - generic: THEA
    - generic [ref=e6]:
      - button "التبديل للوضع الداكن" [ref=e7] [cursor=pointer]:
        - img [ref=e8]
      - button "Switch to English" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
    - generic [ref=e14]:
      - img "Thea" [ref=e16]
      - generic [ref=e17]:
        - heading "مرحباً" [level=1] [ref=e18]
        - paragraph [ref=e19]: أدخل بريدك الإلكتروني للمتابعة
        - form "مرحباً" [ref=e20]:
          - textbox "أدخل بريدك الإلكتروني" [active] [ref=e21]
          - button "متابعة" [disabled] [ref=e22]:
            - generic [ref=e23]:
              - text: متابعة
              - img [ref=e24]
      - progressbar "خطوات تسجيل الدخول" [ref=e26]
  - alert [ref=e30]
```