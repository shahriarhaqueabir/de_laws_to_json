-- Schema for Case Diagnosis, Outcomes, and Remediation Workflows

-- 1. Case Files: Stores the user's specific situation and metadata
CREATE TABLE IF NOT EXISTS public.case_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., 'labor', 'housing', 'immigration'
    situation_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Questionnaire answers
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'resolved'
    incident_date DATE,
    deadline_date DATE,
    dispute_value NUMERIC(12, 2) DEFAULT 0.00, -- Streitwert
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Remediation Playbooks: Blueprints for fixing legal issues
CREATE TABLE IF NOT EXISTS public.remediation_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    issue_type TEXT NOT NULL, -- e.g., 'wrongful_dismissal', 'deposit_retention'
    steps JSONB NOT NULL, -- Array of step objects: {title, description, deadline_rule, type}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Document Templates: German legal templates with placeholders
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL, -- e.g., 'widerspruch-notice'
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content_template TEXT NOT NULL, -- Markdown/Handlebars style template
    placeholders JSONB NOT NULL, -- Required fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remediation_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users own their case files"
    ON public.case_files FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Playbooks are public"
    ON public.remediation_playbooks FOR SELECT
    USING (true);

CREATE POLICY "Templates are public"
    ON public.document_templates FOR SELECT
    USING (true);
