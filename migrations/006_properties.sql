CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  source_ref text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('rent','sale')),
  property_type text NOT NULL,
  county text NOT NULL,
  town text,
  area text,
  price numeric(14,2) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  bedrooms integer CHECK (bedrooms IS NULL OR bedrooms BETWEEN 0 AND 30),
  bathrooms integer CHECK (bathrooms IS NULL OR bathrooms BETWEEN 0 AND 30),
  size_sqm numeric(12,2) CHECK (size_sqm IS NULL OR size_sqm > 0),
  language text NOT NULL DEFAULT 'both' CHECK (language IN ('en','sw','both')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','let','sold','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, source_ref),
  UNIQUE (id, agency_id)
);
CREATE INDEX IF NOT EXISTS properties_tenant_status_idx
  ON properties(agency_id, status, purpose, updated_at DESC);
CREATE INDEX IF NOT EXISTS properties_location_idx
  ON properties(agency_id, county, town, area);
