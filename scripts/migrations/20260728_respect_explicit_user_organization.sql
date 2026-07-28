-- Do not add the default organization when account creation already supplied
-- an explicit primary organization. Run this after the earlier tenant
-- migrations that created ensure_default_organization_membership().

CREATE OR REPLACE FUNCTION public.ensure_default_organization_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id UUID;
  member_role TEXT;
BEGIN
  -- Super-admin and organization-admin account creation writes the intended
  -- organization on the profile before this AFTER INSERT trigger runs.
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE slug = 'sekolahimpian';

  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'Default organization with slug sekolahimpian was not found';
  END IF;

  member_role := CASE
    WHEN NEW.role IN ('owner', 'admin') THEN NEW.role
    ELSE 'ustadz'
  END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (default_org_id, NEW.id, member_role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET organization_id = default_org_id
  WHERE id = NEW.id
    AND organization_id IS NULL;

  RETURN NEW;
END;
$$;
