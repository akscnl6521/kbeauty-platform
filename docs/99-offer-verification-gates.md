# 99 — Offer Verification Gates

스키마: `verification_status` ∈ verified|unverified|invalid|unavailable  
`stock_status` ∈ in_stock|out_of_stock|unknown  
`retailer_country` ∈ KR|US|JP|GLOBAL · currency KRW|USD|JPY

verified 조건: https URL, strong identity, price>0, currency, in_stock, shipping, 공식/인가 등급, draft product 제외.

불확실 → unverified + `review_type=sale` queue. mismatch/seller → invalid.
