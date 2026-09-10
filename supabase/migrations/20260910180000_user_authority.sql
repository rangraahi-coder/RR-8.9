BEGIN;
CREATE TABLE IF NOT EXISTS public.erp_user_access (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false, is_owner boolean NOT NULL DEFAULT false,
 permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(permissions)='object'),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT is_owner OR (is_admin AND active))
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_single_owner ON erp_user_access(is_owner) WHERE is_owner;
ALTER TABLE erp_user_access ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.erp_can(p_module text,p_action text DEFAULT 'view') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.erp_user_access u WHERE u.user_id=auth.uid() AND u.active AND (u.is_owner OR u.is_admin OR coalesce(u.permissions->p_module,'[]'::jsonb) ? p_action))
$$;
REVOKE ALL ON FUNCTION public.erp_can(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_can(text,text) TO authenticated;
DROP POLICY IF EXISTS erp_access_read ON erp_user_access;
CREATE POLICY erp_access_read ON erp_user_access FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.erp_can('users','view'));
GRANT SELECT ON erp_user_access TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON erp_user_access FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.erp_list_users() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.erp_can('users','view') THEN RAISE EXCEPTION 'Administrator required';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',a.id,'email',a.email,'display_name',coalesce(u.display_name,''),'active',coalesce(u.active,false),'is_admin',coalesce(u.is_admin,false),'is_owner',coalesce(u.is_owner,false),'permissions',coalesce(u.permissions,'{}'::jsonb)) ORDER BY a.email),'[]'::jsonb) FROM auth.users a LEFT JOIN public.erp_user_access u ON u.user_id=a.id);
END $$;
CREATE OR REPLACE FUNCTION public.erp_set_user_access(p_user_id uuid,p_name text,p_active boolean,p_admin boolean,p_permissions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE entry record;
BEGIN
 LOCK TABLE public.erp_user_access IN SHARE ROW EXCLUSIVE MODE;
 IF NOT public.erp_can('users','edit') THEN RAISE EXCEPTION 'Administrator required';END IF;
 IF EXISTS(SELECT 1 FROM public.erp_user_access WHERE user_id=p_user_id AND is_owner) THEN RAISE EXCEPTION 'Owner access cannot be changed';END IF;
 IF p_user_id=auth.uid() AND (NOT p_active OR NOT p_admin) THEN RAISE EXCEPTION 'An administrator cannot remove their own access';END IF;
 IF jsonb_typeof(p_permissions) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid permission object';END IF;
 FOR entry IN SELECT * FROM jsonb_each(p_permissions) LOOP
  IF NOT entry.key=ANY(ARRAY['items','accounts','operators','sales','jobs','grey','dyeing','fabric','cutting','embroidery','handwork','stitching','qc','contractor','finishing','ready','dispatch','ledger','audit']) OR jsonb_typeof(entry.value)<>'array' THEN RAISE EXCEPTION 'Invalid module permissions';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(entry.value) a WHERE a<>ALL(ARRAY['view','create','edit','delete'])) OR (jsonb_array_length(entry.value)>0 AND NOT entry.value ? 'view') THEN RAISE EXCEPTION 'Invalid permission action';END IF;
 END LOOP;
 INSERT INTO public.erp_user_access(user_id,display_name,active,is_admin,permissions)VALUES(p_user_id,trim(p_name),p_active,p_admin,p_permissions)
 ON CONFLICT(user_id)DO UPDATE SET display_name=excluded.display_name,active=excluded.active,is_admin=excluded.is_admin,permissions=excluded.permissions,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.erp_list_users(),public.erp_set_user_access(uuid,text,boolean,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_list_users(),public.erp_set_user_access(uuid,text,boolean,boolean,jsonb) TO authenticated;
-- Run only in Supabase SQL Editor, using the existing Rangraahi login email.
CREATE OR REPLACE FUNCTION public.erp_bootstrap_owner(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid;
BEGIN
 LOCK TABLE public.erp_user_access IN SHARE ROW EXCLUSIVE MODE;
 SELECT id INTO STRICT uid FROM auth.users WHERE lower(email)=lower(trim(p_email));
 IF EXISTS(SELECT 1 FROM public.erp_user_access WHERE is_owner AND user_id<>uid) THEN RAISE EXCEPTION 'Owner already configured';END IF;
 INSERT INTO public.erp_user_access(user_id,display_name,active,is_admin,is_owner)VALUES(uid,'Rangraahi',true,true,true)
 ON CONFLICT(user_id)DO UPDATE SET active=true,is_admin=true,is_owner=true,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.erp_bootstrap_owner(text) FROM PUBLIC,anon,authenticated;
COMMIT;
