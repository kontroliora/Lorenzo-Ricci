-- Econt office / automat chosen in the checkout (BG, "До офис или автомат на Еконт"): the office code from Econt's official list
-- (Nomenclatures getOffices). The readable address, with the code in it, is also saved in orders.address as before, so the
-- order works WITHOUT this column; the code is stored here as well once the column exists. Additive, safe to run more than once.
-- Project: xefgrsgijjrmctzezosg (PRODUCTION) - check the ref in the URL before running.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS econt_office_code text;
