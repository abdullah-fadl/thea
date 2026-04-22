# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e4]:
    - generic: THEA
    - generic [ref=e6]:
      - button "Switch to dark mode" [ref=e7] [cursor=pointer]:
        - img [ref=e8]
      - button "التبديل للعربية" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
    - generic [ref=e14]:
      - img "Thea" [ref=e16]
      - generic [ref=e17]:
        - heading "Welcome" [level=1] [ref=e18]
        - paragraph [ref=e19]: Enter your email to continue
        - form "Welcome" [ref=e20]:
          - textbox "Enter your email" [ref=e21]: test-a@example.com
          - alert [ref=e22]: Internal server error
          - button "Continue" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]:
              - text: Continue
              - img [ref=e25]
      - progressbar "Login steps progress" [ref=e27]
  - alert [ref=e31]
```