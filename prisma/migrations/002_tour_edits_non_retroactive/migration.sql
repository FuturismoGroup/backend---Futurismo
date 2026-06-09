-- Migración no destructiva: permite editar tours sin afectar reservas existentes
--
-- Problema corregido:
-- updateTour borraba tour_stops con deleteMany y fallaba con FK constraint (P2003)
-- cuando había tour_progress o tour_photos referenciando esas paradas.
--
-- Cambios:
-- 1. tour_stops.replaced_at TIMESTAMPTZ: marca paradas reemplazadas (soft delete).
--    Las paradas históricas se conservan para tour_progress/tour_photos pero
--    se ocultan de la vista actual del tour.
-- 2. reservations.tour_snapshot JSONB: snapshot inmutable del tour al momento de
--    la edición. Reservas existentes preservan el tour original; nuevas reservas
--    reciben el tour actualizado al consultar la BD por JOIN.

-- 1. Agregar replaced_at a tour_stops
ALTER TABLE "tour_stops"
  ADD COLUMN IF NOT EXISTS "replaced_at" TIMESTAMPTZ;

-- 2. Índice parcial para acelerar lectura de paradas activas
CREATE INDEX IF NOT EXISTS "idx_tour_stops__active"
  ON "tour_stops" ("tour_id")
  WHERE "replaced_at" IS NULL;

-- 3. Agregar tour_snapshot a reservations
ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "tour_snapshot" JSONB;
