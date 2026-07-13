# 71 — Site Crawler

## 우선순위

robots.txt sitemap → sitemap.xml → product sitemap → category → internal links → JSON-LD Product

## 제한

domain concurrency · interval · max pages/depth/URLs · timeout · redirect · page size · robots

## 보안

기존 URL import SSRF 방어와 동등 이상. 차단(403/429/captcha/login) 시 **우회 금지**, `blocked`/`needs_review` 후 다음 브랜드 진행.

구현: `src/lib/pipeline/site-crawler.ts`
