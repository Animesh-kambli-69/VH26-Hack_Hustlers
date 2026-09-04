# 5-minute demo

1. Start Docker:
   `docker compose up --build`
2. Login as admin and save the access token.
3. Repeatedly call `/api/products/P001` through `/api/products/P010`.
4. Call `/api/admin/cache/metrics`.
5. Call `/api/recommendations/<demo-user-id>` once.
6. Call `/api/admin/cache/decisions`.
7. Call the recommendation endpoint again and show `cache.hit=true`.
8. Run `/api/admin/benchmark/run` with `{"scenario":"expensive-rare","requests":200}`.
9. Explain that CAAC optimizes expected backend cost savings rather than hit rate alone.
