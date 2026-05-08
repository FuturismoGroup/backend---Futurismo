-- CreateTable
CREATE TABLE "active_tours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "guide_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'not_started',
    "current_stop_index" SMALLINT NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "last_location_update" TIMESTAMPTZ(6),
    "emergency_protocol_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "ruc" VARCHAR(11) NOT NULL,
    "position" VARCHAR(100),
    "agency_phone" VARCHAR(20),
    "agency_email" VARCHAR(255),
    "agency_address" TEXT,
    "agency_logo" TEXT,
    "whatsapp" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "level" VARCHAR(20) NOT NULL DEFAULT 'bronze',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(3,2),
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_tours" INTEGER NOT NULL DEFAULT 0,
    "available_points" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "certifications" JSONB DEFAULT '[]',
    "specialties" JSONB DEFAULT '[]',
    "languages" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacts" JSONB DEFAULT '[]',
    "payment_methods" JSONB DEFAULT '[]',

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'member',
    "last_read_at" TIMESTAMPTZ(6),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(6),

    CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200),
    "chat_type" VARCHAR(20) NOT NULL DEFAULT 'direct',
    "is_from_agenda" BOOLEAN NOT NULL DEFAULT false,
    "reservation_id" UUID,
    "last_message_at" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" BIGINT,
    "expiry_date" DATE,
    "verification_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "verified_by" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "document_type" VARCHAR(10) NOT NULL DEFAULT 'DNI',
    "document_number" VARCHAR(20) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "license_number" VARCHAR(30) NOT NULL,
    "license_category" VARCHAR(10) NOT NULL,
    "license_expiry" DATE,
    "photo_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "severity_level" SMALLINT NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" VARCHAR(20) DEFAULT '#EF4444',

    CONSTRAINT "emergency_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contact_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) DEFAULT '📞',
    "description" TEXT,
    "color" VARCHAR(20) DEFAULT '#6B7280',
    "priority" SMALLINT DEFAULT 1,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contact_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "contact_type" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_secondary" VARCHAR(20),
    "address" TEXT,
    "location_id" UUID,
    "is_24_hours" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_materials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "unit" VARCHAR(50) DEFAULT 'unidad',
    "is_mandatory" BOOLEAN DEFAULT false,
    "icon" VARCHAR(50) DEFAULT '📦',
    "notes" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criteria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "order_index" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "tour_id" UUID,
    "reservation_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "feedback_type" VARCHAR(30) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'normal',
    "response" TEXT,
    "responded_by" UUID,
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" SMALLINT,
    "suggestions_text" TEXT,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_calculations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "tour_price" DECIMAL(10,2) NOT NULL,
    "participants" INTEGER NOT NULL,
    "guide_commission" DECIMAL(5,2) NOT NULL,
    "estimated_expenses" DECIMAL(10,2) NOT NULL,
    "gross_income" DECIMAL(10,2) NOT NULL,
    "net_income" DECIMAL(10,2) NOT NULL,
    "profit_margin" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guide_locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "active_tour_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(6,2),
    "speed" DECIMAL(6,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "agency_id" UUID,
    "guide_type" VARCHAR(20) NOT NULL DEFAULT 'FREELANCE',
    "license_number" VARCHAR(50),
    "years_of_experience" INTEGER DEFAULT 0,
    "languages" JSONB DEFAULT '[]',
    "specialties" JSONB DEFAULT '[]',
    "certifications" JSONB DEFAULT '[]',
    "museums" JSONB DEFAULT '[]',
    "bio" TEXT,
    "education" TEXT,
    "hourly_rate" DECIMAL(10,2),
    "guide_photo" TEXT,
    "rating" DECIMAL(3,2),
    "online" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" VARCHAR(100),
    "account_type" VARCHAR(20),
    "account_number" VARCHAR(30),
    "interbank_code" VARCHAR(30),
    "account_holder" VARCHAR(200),
    "currency" VARCHAR(3) DEFAULT 'PEN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(20) DEFAULT 'active',

    CONSTRAINT "guides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "tour_id" UUID,
    "reservation_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "source" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "value" VARCHAR(50) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "code" VARCHAR(20),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "file_size" BIGINT,
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chat_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT,
    "message_type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "status" VARCHAR(20) NOT NULL DEFAULT 'sent',
    "reply_to_id" UUID,
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "email_templates" JSONB DEFAULT '{}',
    "reminder_hours_before" JSONB DEFAULT '[24, 2]',
    "notify_on_new_reservation" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_status_change" BOOLEAN NOT NULL DEFAULT true,
    "notify_on_new_rating" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "muted_types" JSONB DEFAULT '[]',
    "quiet_hours_start" TIME(6),
    "quiet_hours_end" TIME(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "notification_type" VARCHAR(30) NOT NULL,
    "priority" VARCHAR(10) NOT NULL DEFAULT 'normal',
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "action_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "module" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "start_datetime" TIMESTAMPTZ(6) NOT NULL,
    "end_datetime" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "event_type" VARCHAR(50) NOT NULL DEFAULT 'personal',
    "color" VARCHAR(20),
    "blocks_availability" BOOLEAN NOT NULL DEFAULT true,
    "recurrence_rule" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "points_per_sol" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "levels" JSONB DEFAULT '[{"name": "Bronce", "minPoints": 0}, {"name": "Plata", "minPoints": 1000}, {"name": "Oro", "minPoints": 5000}]',
    "expiration_months" INTEGER NOT NULL DEFAULT 12,
    "minimum_redemption" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agency_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocol_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "protocol_id" UUID NOT NULL,
    "step_number" SMALLINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "protocol_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protocols" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" VARCHAR(10) DEFAULT 'media',
    "icon" VARCHAR(10) DEFAULT '🚨',
    "contacts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "material_ids" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "provider_service_id" UUID,
    "service_date" DATE NOT NULL,
    "service_time" TIME(6),
    "pax_count" INTEGER,
    "notes" TEXT,
    "quoted_price" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_services" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "service_type" VARCHAR(50) NOT NULL,
    "price" DECIMAL(10,2),
    "price_type" VARCHAR(30) DEFAULT 'per_person',
    "duration_minutes" INTEGER,
    "max_capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "category_id" UUID NOT NULL,
    "location_id" UUID,
    "address" TEXT,
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "contact_name" VARCHAR(150),
    "rating" DECIMAL(2,1),
    "description" TEXT,
    "logo_url" TEXT,
    "capacity" INTEGER,
    "price_type" VARCHAR(30),
    "base_price" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "rated_by_id" UUID NOT NULL,
    "guide_rating" SMALLINT,
    "driver_rating" SMALLINT,
    "vehicle_rating" SMALLINT,
    "overall_rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "value" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20),
    "order_index" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agency_id" UUID NOT NULL,
    "reward_id" UUID NOT NULL,
    "points_used" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "min_advance_hours" INTEGER NOT NULL DEFAULT 24,
    "max_advance_days" INTEGER NOT NULL DEFAULT 90,
    "default_start_time" VARCHAR(10) NOT NULL DEFAULT '08:00',
    "default_end_time" VARCHAR(10) NOT NULL DEFAULT '18:00',
    "time_slot_interval" SMALLINT NOT NULL DEFAULT 30,
    "allow_same_day_booking" BOOLEAN NOT NULL DEFAULT false,
    "require_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "auto_confirm_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cancellation_policy" JSONB DEFAULT '{"hoursBeforeFree": 48, "penaltyPercentage": 50}',
    "overbooking_allowed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tour_id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "time" TIME(6) NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "participants" INTEGER NOT NULL DEFAULT 1,
    "pickup_location" TEXT,
    "special_requirements" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_method" VARCHAR(50),
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "billing_name" VARCHAR(200),
    "billing_document" VARCHAR(20),
    "billing_address" TEXT,
    "points_awarded" INTEGER,
    "guide_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "service_request_id" UUID,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "color" VARCHAR(20),
    "icon" VARCHAR(50),

    CONSTRAINT "reward_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "category_id" UUID,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role_id" INTEGER,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "name" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "service_area_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID,
    "service_id" UUID,
    "rated_by_id" UUID NOT NULL,
    "customer_service" SMALLINT NOT NULL DEFAULT 0,
    "operations" SMALLINT NOT NULL DEFAULT 0,
    "punctuality" SMALLINT NOT NULL DEFAULT 0,
    "communication" SMALLINT NOT NULL DEFAULT 0,
    "logistics" SMALLINT NOT NULL DEFAULT 0,
    "safety" SMALLINT NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2) NOT NULL,
    "comment_customer_service" TEXT,
    "comment_operations" TEXT,
    "comment_punctuality" TEXT,
    "comment_communication" TEXT,
    "comment_logistics" TEXT,
    "comment_safety" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_area_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agency_id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "service_date" DATE NOT NULL,
    "start_time" TIME(6),
    "duration_hours" SMALLINT,
    "group_size" SMALLINT,
    "languages" JSONB,
    "message" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "punctuality" SMALLINT NOT NULL DEFAULT 0,
    "knowledge" SMALLINT NOT NULL DEFAULT 0,
    "communication" SMALLINT NOT NULL DEFAULT 0,
    "professionalism" SMALLINT NOT NULL DEFAULT 0,
    "problem_solving" SMALLINT NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2) NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "additional_comments" TEXT,
    "recommendation" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "feedback_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'submitted',
    "votes_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" VARCHAR(200) NOT NULL DEFAULT 'Futurismo Tours',
    "company_logo" TEXT,
    "company_phone" VARCHAR(50),
    "company_email" VARCHAR(200),
    "company_website" VARCHAR(500),
    "company_address" TEXT,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'America/Lima',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PEN',
    "language" VARCHAR(10) NOT NULL DEFAULT 'es',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'DD/MM/YYYY',
    "time_format" VARCHAR(20) NOT NULL DEFAULT 'HH:mm',
    "theme" JSONB DEFAULT '{"primaryColor": "#1976d2", "secondaryColor": "#dc004e"}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_cci" VARCHAR(50),
    "account_number" VARCHAR(50),
    "company_ruc" VARCHAR(20),
    "admin_email" VARCHAR(200),
    "admin_emergency_phone" VARCHAR(30),
    "admin_office_phone" VARCHAR(30),
    "admin_personal_phone" VARCHAR(30),

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "availability_id" UUID NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "reservation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "guide_id" UUID,
    "driver_id" UUID,
    "vehicle_id" UUID,
    "notes" TEXT,
    "pickup_location" TEXT,
    "pickup_time" TIME(6),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "pdf_generated_at" TIMESTAMPTZ(6),
    "whatsapp_sent_at" TIMESTAMPTZ(6),
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "active_tour_id" UUID NOT NULL,
    "tour_stop_id" UUID,
    "photo_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "caption" VARCHAR(500),
    "taken_by" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "taken_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "active_tour_id" UUID NOT NULL,
    "tour_stop_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "arrived_at" TIMESTAMPTZ(6),
    "departed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_stops" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tour_id" UUID NOT NULL,
    "order_num" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "duration" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tourist_id" UUID NOT NULL,
    "service_id" UUID,
    "reservation_id" UUID,
    "rating" VARCHAR(20) NOT NULL,
    "comments" TEXT,
    "rated_by_id" UUID NOT NULL,
    "tourist_name" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tourist_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(20),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "short_description" VARCHAR(500),
    "category" VARCHAR(50),
    "tour_type" VARCHAR(50),
    "duration" INTEGER,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "child_price" DECIMAL(10,2),
    "max_capacity" INTEGER,
    "includes_guide" BOOLEAN NOT NULL DEFAULT true,
    "includes_transport" BOOLEAN NOT NULL DEFAULT true,
    "meeting_point" TEXT,
    "languages" JSONB DEFAULT '[]',
    "image" TEXT,
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "document_type" VARCHAR(20),
    "document_number" VARCHAR(20),
    "birth_date" DATE,
    "address" TEXT,
    "city" VARCHAR(100),
    "profile_photo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vehicle_id" UUID NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "document_number" VARCHAR(50),
    "expiry_date" DATE NOT NULL,
    "file_url" TEXT,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plate" VARCHAR(15) NOT NULL,
    "brand" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "year" SMALLINT,
    "capacity" SMALLINT,
    "vehicle_type" VARCHAR(30),
    "color" VARCHAR(30),
    "photo_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "guide_id" UUID NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "break_start" TIME(6),
    "break_end" TIME(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terms_and_conditions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(50) NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "effective_date" DATE NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_and_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_terms_acceptance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "terms_id" UUID NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_terms_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "active_tours_reservation_id_key" ON "active_tours"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_active_tours__emergency_protocol_id" ON "active_tours"("emergency_protocol_id");

-- CreateIndex
CREATE INDEX "idx_active_tours__guide_id" ON "active_tours"("guide_id");

-- CreateIndex
CREATE INDEX "idx_active_tours__status" ON "active_tours"("status");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_user_id_unique" ON "agencies"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_ruc_unique" ON "agencies"("ruc");

-- CreateIndex
CREATE INDEX "idx_agencies__business_name" ON "agencies"("business_name");

-- CreateIndex
CREATE INDEX "idx_agencies__level" ON "agencies"("level");

-- CreateIndex
CREATE INDEX "idx_agencies__status" ON "agencies"("status");

-- CreateIndex
CREATE INDEX "idx_audit_logs__action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs__created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs__entity_id" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs__entity_type" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs__user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_availability__date" ON "availability"("date");

-- CreateIndex
CREATE INDEX "idx_availability__guide_date" ON "availability"("guide_id", "date");

-- CreateIndex
CREATE INDEX "idx_availability__guide_id" ON "availability"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "availability_guide_date_unique" ON "availability"("guide_id", "date");

-- CreateIndex
CREATE INDEX "idx_chat_participants__chat_id" ON "chat_participants"("chat_id");

-- CreateIndex
CREATE INDEX "idx_chat_participants__user_id" ON "chat_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_participants_chat_user_key" ON "chat_participants"("chat_id", "user_id");

-- CreateIndex
CREATE INDEX "idx_chats__chat_type" ON "chats"("chat_type");

-- CreateIndex
CREATE INDEX "idx_chats__last_message_at" ON "chats"("last_message_at");

-- CreateIndex
CREATE INDEX "idx_chats__reservation_id" ON "chats"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_documents__document_type" ON "documents"("document_type");

-- CreateIndex
CREATE INDEX "idx_documents__expiry_date" ON "documents"("expiry_date");

-- CreateIndex
CREATE INDEX "idx_documents__user_id" ON "documents"("user_id");

-- CreateIndex
CREATE INDEX "idx_documents__verification_status" ON "documents"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_document_number_key" ON "drivers"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_license_number_key" ON "drivers"("license_number");

-- CreateIndex
CREATE INDEX "idx_drivers__first_name" ON "drivers"("first_name");

-- CreateIndex
CREATE INDEX "idx_drivers__license_category" ON "drivers"("license_category");

-- CreateIndex
CREATE INDEX "idx_drivers__license_expiry" ON "drivers"("license_expiry");

-- CreateIndex
CREATE INDEX "idx_drivers__status" ON "drivers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_categories_name_key" ON "emergency_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contact_types_name_key" ON "emergency_contact_types"("name");

-- CreateIndex
CREATE INDEX "idx_emergency_contact_types__is_active" ON "emergency_contact_types"("is_active");

-- CreateIndex
CREATE INDEX "idx_emergency_contact_types__name" ON "emergency_contact_types"("name");

-- CreateIndex
CREATE INDEX "idx_emergency_contact_types__priority" ON "emergency_contact_types"("priority");

-- CreateIndex
CREATE INDEX "idx_emergency_contacts__contact_type" ON "emergency_contacts"("contact_type");

-- CreateIndex
CREATE INDEX "idx_emergency_contacts__location_id" ON "emergency_contacts"("location_id");

-- CreateIndex
CREATE INDEX "idx_emergency_materials__category" ON "emergency_materials"("category");

-- CreateIndex
CREATE INDEX "idx_emergency_materials__is_active" ON "emergency_materials"("is_active");

-- CreateIndex
CREATE INDEX "idx_emergency_materials__is_mandatory" ON "emergency_materials"("is_mandatory");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_criteria_key_key" ON "evaluation_criteria"("key");

-- CreateIndex
CREATE INDEX "idx_evaluation_criteria__is_active" ON "evaluation_criteria"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_value_key" ON "expense_categories"("value");

-- CreateIndex
CREATE INDEX "idx_expense_categories__value" ON "expense_categories"("value");

-- CreateIndex
CREATE INDEX "idx_expenses__category_id" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "idx_expenses__date" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "idx_expenses__guide_id" ON "expenses"("guide_id");

-- CreateIndex
CREATE INDEX "idx_expenses__tour_id" ON "expenses"("tour_id");

-- CreateIndex
CREATE INDEX "idx_feedback__created_at" ON "feedback"("created_at");

-- CreateIndex
CREATE INDEX "idx_feedback__feedback_type" ON "feedback"("feedback_type");

-- CreateIndex
CREATE INDEX "idx_feedback__status" ON "feedback"("status");

-- CreateIndex
CREATE INDEX "idx_feedback__user_id" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "idx_financial_calculations__created_at" ON "financial_calculations"("created_at");

-- CreateIndex
CREATE INDEX "idx_financial_calculations__guide_id" ON "financial_calculations"("guide_id");

-- CreateIndex
CREATE INDEX "idx_guide_locations__active_tour_id" ON "guide_locations"("active_tour_id");

-- CreateIndex
CREATE INDEX "idx_guide_locations__recorded_at" ON "guide_locations"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "guides_user_id_unique" ON "guides"("user_id");

-- CreateIndex
CREATE INDEX "idx_guides__guide_type" ON "guides"("guide_type");

-- CreateIndex
CREATE INDEX "idx_guides__agency_id" ON "guides"("agency_id");

-- CreateIndex
CREATE INDEX "idx_guides__languages" ON "guides" USING GIN ("languages");

-- CreateIndex
CREATE INDEX "idx_guides__specialties" ON "guides" USING GIN ("specialties");

-- CreateIndex
CREATE INDEX "idx_income__date" ON "income"("date");

-- CreateIndex
CREATE INDEX "idx_income__guide_id" ON "income"("guide_id");

-- CreateIndex
CREATE INDEX "idx_income__tour_id" ON "income"("tour_id");

-- CreateIndex
CREATE INDEX "idx_income__type_id" ON "income"("type_id");

-- CreateIndex
CREATE UNIQUE INDEX "income_types_value_key" ON "income_types"("value");

-- CreateIndex
CREATE INDEX "idx_income_types__value" ON "income_types"("value");

-- CreateIndex
CREATE INDEX "idx_locations__code" ON "locations"("code");

-- CreateIndex
CREATE INDEX "idx_locations__name" ON "locations"("name");

-- CreateIndex
CREATE INDEX "idx_locations__parent_id" ON "locations"("parent_id");

-- CreateIndex
CREATE INDEX "idx_locations__path" ON "locations"("path");

-- CreateIndex
CREATE INDEX "idx_locations__type" ON "locations"("type");

-- CreateIndex
CREATE INDEX "idx_message_attachments__message_id" ON "message_attachments"("message_id");

-- CreateIndex
CREATE INDEX "idx_messages__chat_id" ON "messages"("chat_id");

-- CreateIndex
CREATE INDEX "idx_messages__created_at" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "idx_messages__message_type" ON "messages"("message_type");

-- CreateIndex
CREATE INDEX "idx_messages__reply_to_id" ON "messages"("reply_to_id");

-- CreateIndex
CREATE INDEX "idx_messages__sender_id" ON "messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_notifications__created_at" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_notifications__is_read" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "idx_notifications__notification_type" ON "notifications"("notification_type");

-- CreateIndex
CREATE INDEX "idx_notifications__priority" ON "notifications"("priority");

-- CreateIndex
CREATE INDEX "idx_notifications__reference_id" ON "notifications"("reference_id");

-- CreateIndex
CREATE INDEX "idx_notifications__user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_name_key" ON "payment_methods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "idx_permissions__module" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "idx_personal_events__end_datetime" ON "personal_events"("end_datetime");

-- CreateIndex
CREATE INDEX "idx_personal_events__event_type" ON "personal_events"("event_type");

-- CreateIndex
CREATE INDEX "idx_personal_events__guide_id" ON "personal_events"("guide_id");

-- CreateIndex
CREATE INDEX "idx_personal_events__start_datetime" ON "personal_events"("start_datetime");

-- CreateIndex
CREATE INDEX "idx_points_history__agency_id" ON "points_history"("agency_id");

-- CreateIndex
CREATE INDEX "idx_points_history__created_at" ON "points_history"("created_at");

-- CreateIndex
CREATE INDEX "idx_points_history__type" ON "points_history"("type");

-- CreateIndex
CREATE INDEX "idx_protocol_steps__protocol_id" ON "protocol_steps"("protocol_id");

-- CreateIndex
CREATE UNIQUE INDEX "protocol_steps_protocol_step_key" ON "protocol_steps"("protocol_id", "step_number");

-- CreateIndex
CREATE INDEX "idx_protocols__category_id" ON "protocols"("category_id");

-- CreateIndex
CREATE INDEX "idx_protocols__status" ON "protocols"("status");

-- CreateIndex
CREATE INDEX "idx_provider_assignments__provider_id" ON "provider_assignments"("provider_id");

-- CreateIndex
CREATE INDEX "idx_provider_assignments__reservation_id" ON "provider_assignments"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_provider_assignments__service_date" ON "provider_assignments"("service_date");

-- CreateIndex
CREATE INDEX "idx_provider_assignments__status" ON "provider_assignments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "idx_provider_categories__name" ON "provider_categories"("name");

-- CreateIndex
CREATE INDEX "idx_provider_services__provider_id" ON "provider_services"("provider_id");

-- CreateIndex
CREATE INDEX "idx_provider_services__service_type" ON "provider_services"("service_type");

-- CreateIndex
CREATE INDEX "idx_providers__category_id" ON "providers"("category_id");

-- CreateIndex
CREATE INDEX "idx_providers__location_id" ON "providers"("location_id");

-- CreateIndex
CREATE INDEX "idx_providers__name" ON "providers"("name");

-- CreateIndex
CREATE INDEX "idx_providers__status" ON "providers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_reservation_id_key" ON "ratings"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_ratings__created_at" ON "ratings"("created_at");

-- CreateIndex
CREATE INDEX "idx_ratings__overall_rating" ON "ratings"("overall_rating");

-- CreateIndex
CREATE INDEX "idx_ratings__rated_by_id" ON "ratings"("rated_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_options_value_key" ON "recommendation_options"("value");

-- CreateIndex
CREATE INDEX "idx_recommendation_options__is_active" ON "recommendation_options"("is_active");

-- CreateIndex
CREATE INDEX "idx_redemptions__agency_id" ON "redemptions"("agency_id");

-- CreateIndex
CREATE INDEX "idx_redemptions__reward_id" ON "redemptions"("reward_id");

-- CreateIndex
CREATE INDEX "idx_redemptions__status" ON "redemptions"("status");

-- CreateIndex
CREATE INDEX "idx_reservations__agency_id" ON "reservations"("agency_id");

-- CreateIndex
CREATE INDEX "idx_reservations__created_at" ON "reservations"("created_at");

-- CreateIndex
CREATE INDEX "idx_reservations__date" ON "reservations"("date");

-- CreateIndex
CREATE INDEX "idx_reservations__guide_id" ON "reservations"("guide_id");

-- CreateIndex
CREATE INDEX "idx_reservations__status" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "idx_reservations__tour_id" ON "reservations"("tour_id");

-- CreateIndex
CREATE INDEX "idx_reviews__created_at" ON "reviews"("created_at");

-- CreateIndex
CREATE INDEX "idx_reviews__guide_id" ON "reviews"("guide_id");

-- CreateIndex
CREATE INDEX "idx_reviews__rating" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "idx_reviews__reviewer_id" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "idx_reviews__service_request_id" ON "reviews"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_reward_categories__name" ON "reward_categories"("name");

-- CreateIndex
CREATE INDEX "idx_rewards__active" ON "rewards"("active");

-- CreateIndex
CREATE INDEX "idx_rewards__category_id" ON "rewards"("category_id");

-- CreateIndex
CREATE INDEX "idx_rewards__name" ON "rewards"("name");

-- CreateIndex
CREATE INDEX "idx_rewards__points" ON "rewards"("points");

-- CreateIndex
CREATE INDEX "idx_role_permissions__permission_id" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_roles__name" ON "roles"("name");

-- CreateIndex
CREATE INDEX "idx_service_area_ratings__average_rating" ON "service_area_ratings"("average_rating");

-- CreateIndex
CREATE INDEX "idx_service_area_ratings__created_at" ON "service_area_ratings"("created_at");

-- CreateIndex
CREATE INDEX "idx_service_area_ratings__rated_by_id" ON "service_area_ratings"("rated_by_id");

-- CreateIndex
CREATE INDEX "idx_service_area_ratings__reservation_id" ON "service_area_ratings"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_service_requests__agency_id" ON "service_requests"("agency_id");

-- CreateIndex
CREATE INDEX "idx_service_requests__created_at" ON "service_requests"("created_at");

-- CreateIndex
CREATE INDEX "idx_service_requests__guide_id" ON "service_requests"("guide_id");

-- CreateIndex
CREATE INDEX "idx_service_requests__service_date" ON "service_requests"("service_date");

-- CreateIndex
CREATE INDEX "idx_service_requests__status" ON "service_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "idx_settings__category" ON "settings"("category");

-- CreateIndex
CREATE INDEX "idx_staff_evaluations__created_at" ON "staff_evaluations"("created_at");

-- CreateIndex
CREATE INDEX "idx_staff_evaluations__evaluator_id" ON "staff_evaluations"("evaluator_id");

-- CreateIndex
CREATE INDEX "idx_staff_evaluations__guide_id" ON "staff_evaluations"("guide_id");

-- CreateIndex
CREATE INDEX "idx_suggestions__category" ON "suggestions"("category");

-- CreateIndex
CREATE INDEX "idx_suggestions__created_at" ON "suggestions"("created_at");

-- CreateIndex
CREATE INDEX "idx_suggestions__feedback_id" ON "suggestions"("feedback_id");

-- CreateIndex
CREATE INDEX "idx_suggestions__status" ON "suggestions"("status");

-- CreateIndex
CREATE INDEX "idx_time_slots__availability_id" ON "time_slots"("availability_id");

-- CreateIndex
CREATE INDEX "idx_time_slots__reservation_id" ON "time_slots"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_time_slots__status" ON "time_slots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tour_assignments_reservation_id_key" ON "tour_assignments"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_tour_assignments__driver_id" ON "tour_assignments"("driver_id");

-- CreateIndex
CREATE INDEX "idx_tour_assignments__guide_id" ON "tour_assignments"("guide_id");

-- CreateIndex
CREATE INDEX "idx_tour_assignments__status" ON "tour_assignments"("status");

-- CreateIndex
CREATE INDEX "idx_tour_assignments__vehicle_id" ON "tour_assignments"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_tour_photos__active_tour_id" ON "tour_photos"("active_tour_id");

-- CreateIndex
CREATE INDEX "idx_tour_photos__taken_at" ON "tour_photos"("taken_at");

-- CreateIndex
CREATE INDEX "idx_tour_photos__tour_stop_id" ON "tour_photos"("tour_stop_id");

-- CreateIndex
CREATE INDEX "idx_tour_progress__active_tour_id" ON "tour_progress"("active_tour_id");

-- CreateIndex
CREATE INDEX "idx_tour_progress__tour_stop_id" ON "tour_progress"("tour_stop_id");

-- CreateIndex
CREATE UNIQUE INDEX "tour_progress_active_tour_stop_key" ON "tour_progress"("active_tour_id", "tour_stop_id");

-- CreateIndex
CREATE INDEX "idx_tour_stops__tour_id" ON "tour_stops"("tour_id");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__created_at" ON "tourist_ratings"("created_at");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__rated_by_id" ON "tourist_ratings"("rated_by_id");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__rating" ON "tourist_ratings"("rating");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__reservation_id" ON "tourist_ratings"("reservation_id");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__service_id" ON "tourist_ratings"("service_id");

-- CreateIndex
CREATE INDEX "idx_tourist_ratings__tourist_id" ON "tourist_ratings"("tourist_id");

-- CreateIndex
CREATE UNIQUE INDEX "tours_code_key" ON "tours"("code");

-- CreateIndex
CREATE INDEX "idx_tours__active" ON "tours"("active");

-- CreateIndex
CREATE INDEX "idx_tours__category" ON "tours"("category");

-- CreateIndex
CREATE INDEX "idx_tours__name" ON "tours"("name");

-- CreateIndex
CREATE INDEX "idx_tours__tour_type" ON "tours"("tour_type");

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_name_key" ON "tour_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tour_categories_code_key" ON "tour_categories"("code");

-- CreateIndex
CREATE INDEX "idx_tour_categories__code" ON "tour_categories"("code");

-- CreateIndex
CREATE INDEX "idx_tour_categories__is_active" ON "tour_categories"("is_active");

-- CreateIndex
CREATE INDEX "idx_user_favorites__guide_id" ON "user_favorites"("guide_id");

-- CreateIndex
CREATE INDEX "idx_user_favorites__user_id" ON "user_favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_unique" ON "user_favorites"("user_id", "guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users__username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users__email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users__status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_users__deleted_at" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_vehicle_documents__document_type" ON "vehicle_documents"("document_type");

-- CreateIndex
CREATE INDEX "idx_vehicle_documents__expiry_date" ON "vehicle_documents"("expiry_date");

-- CreateIndex
CREATE INDEX "idx_vehicle_documents__vehicle_id" ON "vehicle_documents"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE INDEX "idx_vehicles__brand" ON "vehicles"("brand");

-- CreateIndex
CREATE INDEX "idx_vehicles__status" ON "vehicles"("status");

-- CreateIndex
CREATE INDEX "idx_vehicles__vehicle_type" ON "vehicles"("vehicle_type");

-- CreateIndex
CREATE INDEX "idx_working_hours__day_of_week" ON "working_hours"("day_of_week");

-- CreateIndex
CREATE INDEX "idx_working_hours__guide_id" ON "working_hours"("guide_id");

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_guide_day_unique" ON "working_hours"("guide_id", "day_of_week");

-- CreateIndex
CREATE INDEX "idx_terms__type_active" ON "terms_and_conditions"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "terms_type_version_unique" ON "terms_and_conditions"("type", "version");

-- CreateIndex
CREATE INDEX "idx_user_terms__user_id" ON "user_terms_acceptance"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_terms__terms_id" ON "user_terms_acceptance"("terms_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_terms_unique" ON "user_terms_acceptance"("user_id", "terms_id");

-- AddForeignKey
ALTER TABLE "active_tours" ADD CONSTRAINT "fk_active_tours__emergency_protocol_id__protocols" FOREIGN KEY ("emergency_protocol_id") REFERENCES "protocols"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "active_tours" ADD CONSTRAINT "fk_active_tours__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "active_tours" ADD CONSTRAINT "fk_active_tours__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "fk_agencies__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "fk_availability__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "fk_chat_participants__chat_id__chats" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_participants" ADD CONSTRAINT "fk_chat_participants__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "fk_chats__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "fk_chats__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "fk_documents__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "fk_documents__verified_by__users" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "fk_emergency_contacts__location_id__locations" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "fk_feedback__responded_by__users" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "fk_feedback__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "financial_calculations" ADD CONSTRAINT "financial_calculations_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_locations" ADD CONSTRAINT "fk_guide_locations__active_tour_id__active_tours" FOREIGN KEY ("active_tour_id") REFERENCES "active_tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "fk_guides__agency_id__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "guides" ADD CONSTRAINT "fk_guides__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income" ADD CONSTRAINT "income_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "income_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "fk_locations__parent_id__locations" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "fk_message_attachments__message_id__messages" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages__chat_id__chats" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages__reply_to_id__messages" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "fk_messages__sender_id__users" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "fk_notification_settings__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "fk_notifications__user_id__users" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "personal_events" ADD CONSTRAINT "fk_personal_events__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "points_history" ADD CONSTRAINT "fk_points_history__agency_id__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "points_history" ADD CONSTRAINT "fk_points_history__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocol_steps" ADD CONSTRAINT "fk_protocol_steps__protocol_id__protocols" FOREIGN KEY ("protocol_id") REFERENCES "protocols"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "fk_protocols__approved_by__users" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "fk_protocols__category_id__emergency_categories" FOREIGN KEY ("category_id") REFERENCES "emergency_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "protocols" ADD CONSTRAINT "fk_protocols__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_assignments" ADD CONSTRAINT "fk_provider_assignments__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_assignments" ADD CONSTRAINT "fk_provider_assignments__provider_id__providers" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_assignments" ADD CONSTRAINT "fk_provider_assignments__provider_service_id__provider_services" FOREIGN KEY ("provider_service_id") REFERENCES "provider_services"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_assignments" ADD CONSTRAINT "fk_provider_assignments__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "provider_services" ADD CONSTRAINT "fk_provider_services__provider_id__providers" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "fk_providers__category_id__provider_categories" FOREIGN KEY ("category_id") REFERENCES "provider_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "fk_providers__location_id__locations" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings__rated_by_id__users" FOREIGN KEY ("rated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "fk_redemptions__agency_id__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "fk_redemptions__approved_by__users" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "fk_redemptions__reward_id__rewards" FOREIGN KEY ("reward_id") REFERENCES "rewards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations__agency_id__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "fk_reservations__tour_id__tours" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews__reviewer_id__users" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews__service_request_id__service_requests" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "fk_rewards__category_id__reward_categories" FOREIGN KEY ("category_id") REFERENCES "reward_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions__permission_id__permissions" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_role_permissions__role_id__roles" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_area_ratings" ADD CONSTRAINT "fk_service_area_ratings__rated_by_id__users" FOREIGN KEY ("rated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_area_ratings" ADD CONSTRAINT "fk_service_area_ratings__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__agency_id__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "fk_service_requests__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "fk_settings__updated_by__users" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_evaluations" ADD CONSTRAINT "fk_staff_evaluations__evaluator_id__users" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "staff_evaluations" ADD CONSTRAINT "fk_staff_evaluations__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "fk_suggestions__created_by__users" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "fk_suggestions__feedback_id__feedback" FOREIGN KEY ("feedback_id") REFERENCES "feedback"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "fk_time_slots__availability_id__availability" FOREIGN KEY ("availability_id") REFERENCES "availability"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "fk_time_slots__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_assignments" ADD CONSTRAINT "fk_tour_assignments__assigned_by__users" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_assignments" ADD CONSTRAINT "fk_tour_assignments__driver_id__drivers" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_assignments" ADD CONSTRAINT "fk_tour_assignments__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_assignments" ADD CONSTRAINT "fk_tour_assignments__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_assignments" ADD CONSTRAINT "fk_tour_assignments__vehicle_id__vehicles" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_photos" ADD CONSTRAINT "fk_tour_photos__active_tour_id__active_tours" FOREIGN KEY ("active_tour_id") REFERENCES "active_tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_photos" ADD CONSTRAINT "fk_tour_photos__taken_by__users" FOREIGN KEY ("taken_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_photos" ADD CONSTRAINT "fk_tour_photos__tour_stop_id__tour_stops" FOREIGN KEY ("tour_stop_id") REFERENCES "tour_stops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_progress" ADD CONSTRAINT "fk_tour_progress__active_tour_id__active_tours" FOREIGN KEY ("active_tour_id") REFERENCES "active_tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_progress" ADD CONSTRAINT "fk_tour_progress__tour_stop_id__tour_stops" FOREIGN KEY ("tour_stop_id") REFERENCES "tour_stops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tour_stops" ADD CONSTRAINT "fk_tour_stops__tour_id__tours" FOREIGN KEY ("tour_id") REFERENCES "tours"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tourist_ratings" ADD CONSTRAINT "fk_tourist_ratings__rated_by_id__users" FOREIGN KEY ("rated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tourist_ratings" ADD CONSTRAINT "fk_tourist_ratings__reservation_id__reservations" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "fk_users__role_id__roles" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "fk_vehicle_documents__vehicle_id__vehicles" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "fk_working_hours__guide_id__guides" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_terms_acceptance" ADD CONSTRAINT "fk_user_terms__terms_id" FOREIGN KEY ("terms_id") REFERENCES "terms_and_conditions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_terms_acceptance" ADD CONSTRAINT "fk_user_terms__user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable
CREATE TABLE "languages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "native_name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_material_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "material_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "order_index" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agency_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100),
    "bank" VARCHAR(100),
    "account_number" VARCHAR(30),
    "cci" VARCHAR(25),
    "card_number" VARCHAR(20),
    "phone_number" VARCHAR(20),
    "holder_name" VARCHAR(200),
    "currency" VARCHAR(3) DEFAULT 'PEN',
    "account_type" VARCHAR(20),
    "card_type" VARCHAR(20),
    "expiry_date" VARCHAR(10),
    "description" TEXT,
    "is_main" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100),
    "bank" VARCHAR(100),
    "account_number" VARCHAR(30),
    "cci" VARCHAR(25),
    "card_number" VARCHAR(20),
    "phone_number" VARCHAR(20),
    "holder_name" VARCHAR(200),
    "currency" VARCHAR(3) DEFAULT 'PEN',
    "account_type" VARCHAR(20),
    "card_type" VARCHAR(20),
    "expiry_date" VARCHAR(10),
    "description" TEXT,
    "is_main" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" SMALLINT DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_guides__status" ON "guides"("status");

-- CreateIndex
CREATE UNIQUE INDEX "languages_code_key" ON "languages"("code");

-- CreateIndex
CREATE INDEX "idx_languages__code" ON "languages"("code");

-- CreateIndex
CREATE INDEX "idx_languages__is_active" ON "languages"("is_active");

-- CreateIndex
CREATE INDEX "idx_languages__sort_order" ON "languages"("sort_order");

-- CreateIndex
CREATE INDEX "idx_emergency_material_items__material_id" ON "emergency_material_items"("material_id");

-- CreateIndex
CREATE INDEX "idx_emergency_material_items__order_index" ON "emergency_material_items"("material_id", "order_index");

-- CreateIndex
CREATE INDEX "idx_apm__agency_id" ON "agency_payment_methods"("agency_id");

-- CreateIndex
CREATE INDEX "idx_apm__is_active" ON "agency_payment_methods"("is_active");

-- CreateIndex
CREATE INDEX "idx_apm__type" ON "agency_payment_methods"("type");

-- CreateIndex
CREATE INDEX "idx_spm__is_active" ON "system_payment_methods"("is_active");

-- CreateIndex
CREATE INDEX "idx_spm__type" ON "system_payment_methods"("type");

-- AddForeignKey
ALTER TABLE "emergency_material_items" ADD CONSTRAINT "fk_material_items__material_id__emergency_materials" FOREIGN KEY ("material_id") REFERENCES "emergency_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_payment_methods" ADD CONSTRAINT "fk_agency_payment_methods__agencies" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- =============================================================================
-- FUNCIONES Y TRIGGERS - Soft Delete sincronizado entre users <-> guides
-- =============================================================================

-- CreateFunction: Sincroniza soft delete de guide -> user
CREATE OR REPLACE FUNCTION public.sync_guide_to_user_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verificar si el status cambió a 'deleted'
    IF NEW.status = 'deleted' AND (OLD.status IS NULL OR OLD.status != 'deleted') THEN
        -- Marcar el usuario asociado como 'deleted'
        UPDATE users
        SET
            status = 'deleted',
            deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id
        AND status != 'deleted';

        RAISE NOTICE 'Usuario % marcado como deleted debido a eliminación del guide %', NEW.user_id, NEW.id;

    -- Verificar si el status cambió de 'deleted' a otro estado (reactivación)
    ELSIF OLD.status = 'deleted' AND NEW.status != 'deleted' THEN
        -- Reactivar el usuario asociado
        UPDATE users
        SET
            status = NEW.status,
            deleted_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.user_id
        AND status = 'deleted';

        RAISE NOTICE 'Usuario % reactivado debido a reactivación del guide %', NEW.user_id, NEW.id;
    END IF;

    RETURN NEW;
END;
$function$;

-- CreateFunction: Sincroniza soft delete de user -> guide
CREATE OR REPLACE FUNCTION public.sync_user_to_guide_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Verificar si el status cambió a 'deleted'
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

    -- Verificar si el status cambió de 'deleted' a otro estado (reactivación)
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

-- CreateTrigger: Dispara sync cuando cambia status de guide
CREATE TRIGGER trigger_sync_guide_to_user_soft_delete
    AFTER UPDATE OF status ON public.guides
    FOR EACH ROW
    WHEN (((old.status)::text IS DISTINCT FROM (new.status)::text))
    EXECUTE FUNCTION sync_guide_to_user_soft_delete();

-- CreateTrigger: Dispara sync cuando cambia status de user
CREATE TRIGGER trigger_sync_user_to_guide_soft_delete
    AFTER UPDATE OF status ON public.users
    FOR EACH ROW
    WHEN (((old.status)::text IS DISTINCT FROM (new.status)::text))
    EXECUTE FUNCTION sync_user_to_guide_soft_delete();

