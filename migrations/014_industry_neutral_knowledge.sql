-- Generalize tenant knowledge from the original real-estate-only schema.
-- Existing tenant documents are assigned to each company's default knowledge base.
INSERT INTO company_settings(agency_id,industry,display_name)
SELECT id,'general',name FROM agencies
ON CONFLICT (agency_id) DO NOTHING;

INSERT INTO company_ai_settings(agency_id)
SELECT id FROM agencies
ON CONFLICT (agency_id) DO NOTHING;

INSERT INTO knowledge_bases(agency_id,name,industry,is_default)
SELECT a.id,'Company Knowledge',COALESCE(cs.industry,'general'),true
FROM agencies a
LEFT JOIN company_settings cs ON cs.agency_id=a.id
WHERE NOT EXISTS (
  SELECT 1 FROM knowledge_bases kb WHERE kb.agency_id=a.id AND kb.is_default=true
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_bases_one_default_uq
  ON knowledge_bases(agency_id) WHERE is_default=true;

CREATE TABLE IF NOT EXISTS knowledge_category_templates (
  industry text NOT NULL,
  category text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  metadata_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 100,
  PRIMARY KEY(industry,category),
  CHECK(industry ~ '^[a-z][a-z0-9_-]{1,49}$'),
  CHECK(category ~ '^[a-z][a-z0-9_-]{0,63}$')
);

INSERT INTO knowledge_category_templates(industry,category,display_name,description,sort_order) VALUES
('general','faq','Frequently asked questions','Verified answers to common customer questions',10),
('general','products_services','Products and services','What the company offers, service details and eligibility',20),
('general','policies','Policies and terms','Company policies, terms, conditions and customer commitments',30),
('general','pricing','Pricing and fees','Approved prices, fees, billing rules and quote conditions',40),
('general','procedures','Processes and procedures','Step-by-step workflows, requirements and service procedures',50),
('general','business_profile','Company information','Company profile, locations, contacts, opening hours and operating context',60),
('general','troubleshooting','Troubleshooting','Verified troubleshooting steps and support resolutions',70),
('general','contact_information','Contact information','Approved contact channels, escalation contacts and office details',80),
('real_estate','property_listing','Property listings','Property descriptions, availability, rental or sale terms and viewing details',10),
('healthcare','services','Healthcare services','Service descriptions, departments, clinician profiles and booking information; not a substitute for clinical judgment',10),
('healthcare','patient_information','Patient information','Approved patient-facing administrative and educational information; clinical decisions require qualified professionals',20),
('education','courses_programs','Courses and programs','Course descriptions, entry requirements, schedules and learning outcomes',10),
('ecommerce','catalog_items','Catalog items','Product descriptions, specifications, stock and fulfillment information',10),
('hospitality','rooms_services','Rooms and services','Room types, amenities, reservations and guest services',10),
('professional_services','service_offerings','Professional services','Service scope, qualifications, engagement process and client information',10)
ON CONFLICT(industry,category) DO NOTHING;

ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS knowledge_base_id uuid;

UPDATE knowledge_documents d
SET knowledge_base_id=kb.id
FROM knowledge_bases kb
WHERE d.agency_id=kb.agency_id
  AND kb.is_default=true
  AND d.knowledge_base_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='knowledge_documents_agency_base_fk'
  ) THEN
    ALTER TABLE knowledge_documents
      ADD CONSTRAINT knowledge_documents_agency_base_fk
      FOREIGN KEY (agency_id,knowledge_base_id)
      REFERENCES knowledge_bases(agency_id,id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_category_check;
ALTER TABLE knowledge_documents
  ADD CONSTRAINT knowledge_documents_category_check
  CHECK(category ~ '^[a-z][a-z0-9_-]{0,63}$');

DROP INDEX IF EXISTS knowledge_documents_tenant_source_ref_uq;
CREATE UNIQUE INDEX knowledge_documents_tenant_source_ref_uq
  ON knowledge_documents(agency_id,knowledge_base_id,category,source_ref)
  WHERE source_ref IS NOT NULL AND agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS knowledge_documents_base_active_category_idx
  ON knowledge_documents(agency_id,knowledge_base_id,is_active,category);
