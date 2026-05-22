-- Migración no destructiva: alinea provider_services con el nuevo modelo basado en category_id
-- - Agrega category_id (nullable temporalmente)
-- - Rellena category_id desde providers.category_id para filas existentes
-- - Marca category_id como NOT NULL una vez poblada
-- - Hace provider_id nullable para que Prisma pueda insertar sin él
-- - Crea FK e índice de category_id -> provider_categories(id)
-- Conserva provider_id, price y price_type para mantener compatibilidad con serviceController.js (legacy)

-- 1. Agregar columna category_id (nullable temporalmente)
ALTER TABLE "provider_services"
  ADD COLUMN IF NOT EXISTS "category_id" UUID;

-- 2. Poblar category_id en filas existentes usando la categoría del proveedor
UPDATE "provider_services" ps
SET "category_id" = p."category_id"
FROM "providers" p
WHERE ps."provider_id" = p."id"
  AND ps."category_id" IS NULL;

-- 3. Si quedaron filas huérfanas (sin provider o provider sin categoría), asignarles
--    la primera categoría disponible para que la siguiente sentencia NOT NULL no falle.
UPDATE "provider_services"
SET "category_id" = (SELECT id FROM "provider_categories" ORDER BY created_at ASC LIMIT 1)
WHERE "category_id" IS NULL;

-- 4. Hacer category_id NOT NULL (solo si no lo es ya)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_services'
      AND column_name = 'category_id'
      AND is_nullable = 'YES'
  ) THEN
    -- Si aún hay NULLs (porque no había categorías), abortar con mensaje claro
    IF EXISTS (SELECT 1 FROM "provider_services" WHERE "category_id" IS NULL) THEN
      RAISE EXCEPTION 'No se puede convertir category_id en NOT NULL: aún hay filas con NULL. Crea al menos una provider_category y reintenta.';
    END IF;
    ALTER TABLE "provider_services" ALTER COLUMN "category_id" SET NOT NULL;
  END IF;
END
$$;

-- 5. Hacer provider_id nullable (Prisma ya no lo conoce y no lo envía en INSERTs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'provider_services'
      AND column_name = 'provider_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "provider_services" ALTER COLUMN "provider_id" DROP NOT NULL;
  END IF;
END
$$;

-- 6. Crear índice sobre category_id (idempotente)
CREATE INDEX IF NOT EXISTS "idx_provider_services__category_id"
  ON "provider_services" ("category_id");

-- 7. Crear foreign key category_id -> provider_categories(id) si aún no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'provider_services'
      AND constraint_name = 'fk_provider_services__category_id__provider_categories'
  ) THEN
    ALTER TABLE "provider_services"
      ADD CONSTRAINT "fk_provider_services__category_id__provider_categories"
      FOREIGN KEY ("category_id") REFERENCES "provider_categories" ("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END
$$;
