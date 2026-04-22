# Order Sets QA

## Scope
- Clinical shortcuts only
- Generate orders, no pricing

## Checks
1. Create an order set and add items.
2. Apply the set to an encounter and confirm orders are created.
3. Confirm no pricing fields are required or stored in order set items.
4. Double POST (apply):
   - Apply the same set to the same encounter twice → expect no duplicate application.
5. Post-change behavior:
   - Edit an order set item after applying; existing orders remain unchanged.
6. Cross-catalog mapping failure:
   - Add a PROCEDURE item with invalid charge code → expect validation error.
