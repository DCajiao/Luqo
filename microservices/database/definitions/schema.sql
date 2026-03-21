-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(255),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices table
CREATE TABLE invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_path       VARCHAR(500),
    vendor_name      VARCHAR(255),
    invoice_number   VARCHAR(100),
    invoice_date     DATE,
    due_date         DATE,
    subtotal         NUMERIC(12, 2),
    tax_amount       NUMERIC(12, 2),
    total_amount     NUMERIC(12, 2),
    currency         VARCHAR(10) DEFAULT 'COP',
    extracted_data   JSONB,
    gemini_insights  TEXT,
    status           VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items table
CREATE TABLE invoice_items (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description  VARCHAR(500),
    quantity     NUMERIC(10, 3),
    unit_price   NUMERIC(12, 2),
    total_price  NUMERIC(12, 2),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_user_id  ON invoices(user_id);
CREATE INDEX idx_invoices_status   ON invoices(status);
CREATE INDEX idx_invoice_items_inv ON invoice_items(invoice_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
