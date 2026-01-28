-- Create Announcements Table
CREATE TABLE IF NOT EXISTS public.cms_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_cms_announcements_priority ON public.cms_announcements(priority);
CREATE INDEX idx_cms_announcements_active ON public.cms_announcements(is_active);
CREATE INDEX idx_cms_announcements_created_at ON public.cms_announcements(created_at);

-- Enable RLS
ALTER TABLE public.cms_announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public read access (only active announcements)
CREATE POLICY "Public read access" ON public.cms_announcements 
    FOR SELECT 
    USING (is_active = true);

-- Authenticated users full access
CREATE POLICY "Authenticated users full access" ON public.cms_announcements 
    FOR ALL 
    USING (auth.role() = 'authenticated');
