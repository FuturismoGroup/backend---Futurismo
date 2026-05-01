-- =============================================================================
-- OBJETOS DE BASE DE DATOS - Futurismo App
-- =============================================================================
-- Script para crear funciones y triggers en la nueva PC
-- Ejecutar DESPUES de: npx prisma migrate deploy && npx prisma db seed
--
-- Comando:  psql -h 127.0.0.1 -U postgres -d futurismo_db -f db-objects.sql
-- =============================================================================

-- =============================================
-- 1. FUNCION: sync_guide_to_user_soft_delete
-- =============================================
-- Cuando un guide cambia su status a 'deleted', marca al user asociado
-- como 'deleted' automaticamente. Tambien maneja la reactivacion.

CREATE OR REPLACE FUNCTION public.sync_guide_to_user_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verificar si el status cambio a 'deleted'
    IF NEW.status = 'deleted' AND (OLD.status IS NULL OR OLD.status != 'deleted') THEN
        -- Marcar el usuario asociado como 'deleted'
        UPDATE users
        SET
            status = 'deleted',
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id
        AND status != 'deleted';

        RAISE NOTICE 'Usuario % marcado como deleted debido a eliminacion del guide %', NEW.user_id, NEW.id;

    -- Verificar si el status cambio de 'deleted' a otro estado (reactivacion)
    ELSIF OLD.status = 'deleted' AND NEW.status != 'deleted' THEN
        -- Reactivar el usuario asociado
        UPDATE users
        SET
            status = NEW.status,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id
        AND status = 'deleted';

        RAISE NOTICE 'Usuario % reactivado debido a reactivacion del guide %', NEW.user_id, NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

-- =============================================
-- 2. FUNCION: sync_user_to_guide_soft_delete
-- =============================================
-- Cuando un user cambia su status a 'deleted', marca al guide asociado
-- como 'deleted' automaticamente. Tambien maneja la reactivacion.

CREATE OR REPLACE FUNCTION public.sync_user_to_guide_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verificar si el status cambio a 'deleted'
    IF NEW.status = 'deleted' AND (OLD.status IS NULL OR OLD.status != 'deleted') THEN
        -- Marcar el guide asociado como 'deleted' (si existe)
        UPDATE guides
        SET
            status = 'deleted',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.id
        AND status != 'deleted';

        IF FOUND THEN
            RAISE NOTICE 'Guide asociado al usuario % marcado como deleted', NEW.id;
        END IF;

    -- Verificar si el status cambio de 'deleted' a otro estado (reactivacion)
    ELSIF OLD.status = 'deleted' AND NEW.status != 'deleted' THEN
        -- Reactivar el guide asociado (si existe)
        UPDATE guides
        SET
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.id
        AND status = 'deleted';

        IF FOUND THEN
            RAISE NOTICE 'Guide asociado al usuario % reactivado', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- =============================================
-- 3. TRIGGER: guides -> users (soft delete sync)
-- =============================================
-- Se dispara cuando cambia el campo 'status' en la tabla guides

DROP TRIGGER IF EXISTS trigger_sync_guide_to_user_soft_delete ON public.guides;

CREATE TRIGGER trigger_sync_guide_to_user_soft_delete
    AFTER UPDATE OF status ON public.guides
    FOR EACH ROW
    WHEN (((old.status)::text IS DISTINCT FROM (new.status)::text))
    EXECUTE FUNCTION sync_guide_to_user_soft_delete();

-- =============================================
-- 4. TRIGGER: users -> guides (soft delete sync)
-- =============================================
-- Se dispara cuando cambia el campo 'status' en la tabla users

DROP TRIGGER IF EXISTS trigger_sync_user_to_guide_soft_delete ON public.users;

CREATE TRIGGER trigger_sync_user_to_guide_soft_delete
    AFTER UPDATE OF status ON public.users
    FOR EACH ROW
    WHEN (((old.status)::text IS DISTINCT FROM (new.status)::text))
    EXECUTE FUNCTION sync_user_to_guide_soft_delete();

-- =============================================================================
-- VERIFICACION
-- =============================================================================
DO $$
DECLARE
    fn_count INTEGER;
    tr_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fn_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('sync_guide_to_user_soft_delete', 'sync_user_to_guide_soft_delete');

    SELECT COUNT(*) INTO tr_count
    FROM pg_trigger
    WHERE tgname IN ('trigger_sync_guide_to_user_soft_delete', 'trigger_sync_user_to_guide_soft_delete')
    AND tgisinternal = false;

    RAISE NOTICE '';
    RAISE NOTICE '=============================================';
    RAISE NOTICE '  OBJETOS CREADOS EXITOSAMENTE';
    RAISE NOTICE '=============================================';
    RAISE NOTICE '  Funciones: % de 2', fn_count;
    RAISE NOTICE '  Triggers:  % de 2', tr_count;
    RAISE NOTICE '=============================================';

    IF fn_count = 2 AND tr_count = 2 THEN
        RAISE NOTICE '  Estado: TODO OK';
    ELSE
        RAISE WARNING '  Estado: FALTAN OBJETOS - revisar errores arriba';
    END IF;
END;
$$;
