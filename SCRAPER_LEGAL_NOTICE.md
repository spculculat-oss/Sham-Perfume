# Scraper Legal Notice — L-03 Critical Fix

**Status:** SCRAPER DISABLED (legal compliance)

## What was wrong
- `scripts/scraper/` + `scripts/shaheen-import/` imported 1060 products from `shamperfume.com` (MYR prices → EGP ×1.5 markup) without public evidence of license/permission.
- Risk: copyright infringement (Berne/Egypt 82/2002, US DMCA 512, EU DSM 2019/790), breach of target site ToS, CFAA-like liability, and unfair competition.
- 50% markup on scraped supplier price without disclosing source cost basis misleads consumers (EU UCPD, US FTC).

## Fix applied (this commit)
1. **Import scripts disabled** — `scripts/shaheen-import/*` now requires `SHAM_ALLOW_SCRAPE=1` + written permission file `docs/legal/scraper-permission.md`.
2. **API scrape endpoints removed** — `api/main.py` `/api/scrape` guarded by admin token; `server/app.ts` no import-trigger routes.
3. **Products flagged** — `src/data/products.json` items with `source: "shamperfume"` marked `imported: true` + `legalNotice` field; Storefront shows "مستورد — يتطلب ترخيص" badge.
4. **Future imports require:** (a) written license, (b) robots.txt respect, (c) attribution, (d) takedown within 48h (DMCA 512).

## How to re-enable legally
1. Obtain signed permission from `shamperfume.com` (or new supplier) — store in `docs/legal/scraper-permission.md`.
2. Set env `SHAM_ALLOW_SCRAPE=1` + `SHAM_SCRAPE_SOURCE_TOKEN`.
3. Run `npm run import -- --source=shamperfume --dry-run` to audit robots.txt/ToS.
4. Legal review 7-day cooling period before publishing.

## References
- L-03 in `docs/legal/التقرير-القانوني-الشامل-شام-بيرفيوم-2026.md`
- `src/legal/legalExpert.ts` #L-03
