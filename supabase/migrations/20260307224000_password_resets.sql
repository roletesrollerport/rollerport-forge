
CREATE TABLE IF NOT EXISTS "public"."password_resets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used" boolean DEFAULT false,
    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."password_resets" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "idx_password_resets_code" ON "public"."password_resets" USING "btree" ("code");
CREATE INDEX IF NOT EXISTS "idx_password_resets_user_id" ON "public"."password_resets" USING "btree" ("user_id");

-- Grant permissions (Edge Functions use service_role usually, but good to have)
GRANT ALL ON TABLE "public"."password_resets" TO "service_role";
GRANT ALL ON TABLE "public"."password_resets" TO "postgres";
