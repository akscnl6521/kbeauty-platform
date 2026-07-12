-- Restore machine-translated / misspelled brand names to canonical Latin brand names.
-- Do not auto-translate brand names.

UPDATE products SET brand = 'Peach Slices'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'peach slices', '복숭아 조각', '복숭아조각'
) OR trim(brand) IN ('복숭아 조각', '복숭아조각');

UPDATE products SET brand = 'Beauty of Joseon'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'beauty of joseon'
) OR trim(brand) IN ('조선의 아름다움', '조선의 아룸다움');

UPDATE products SET brand = 'ETUDE'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'etude', 'etude house'
) OR trim(brand) IN ('에뛰드', '에뛰드 하우스', '에뛰드하우스');

UPDATE products SET brand = 'TIRTIR'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('tirtir')
   OR trim(brand) IN ('티르티르');

UPDATE products SET brand = 'medicube'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('medicube')
   OR trim(brand) IN ('메디큐브');

UPDATE products SET brand = 'COSRX'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('cosrx')
   OR trim(brand) IN ('코스알엑스');

UPDATE products SET brand = 'Isntree'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('isntree', 'isn tree');

UPDATE products SET brand = 'Rovectin'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('rovectin');

UPDATE products SET brand = 'SKIN1004'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('skin1004', 'skin 1004');

UPDATE products SET brand = 'Purito'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('purito');

UPDATE products SET brand = 'Klairs'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'klairs', 'dear klairs', 'dear, klairs'
);

UPDATE products SET brand = 'Dr. Jart+'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'dr. jart+', 'dr jart+', 'dr.jart+', 'dr jart', 'dr. jart'
);

UPDATE products SET brand = 'Abib'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('abib');

UPDATE products SET brand = 'Nacific'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('nacific');

UPDATE products SET brand = 'mixsoon'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('mixsoon', 'mix soon');

UPDATE products SET brand = 'Axis-Y'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN ('axis-y', 'axis y', 'axisy');

UPDATE products SET brand = 'Some By Mi'
WHERE lower(regexp_replace(trim(brand), '\s+', ' ', 'g')) IN (
  'some by mi', 'somebymi', 'some by me'
);
