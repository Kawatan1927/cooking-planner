CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"date" date NOT NULL,
	"meal_type" varchar NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" numeric NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "menus_meal_type_check" CHECK ("menus"."meal_type" IN ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_name" varchar NOT NULL,
	"quantity_value" numeric,
	"quantity_text" varchar,
	"unit" varchar NOT NULL,
	"note" varchar,
	CONSTRAINT "recipe_ingredients_quantity_check" CHECK (("recipe_ingredients"."quantity_value" IS NULL) <> ("recipe_ingredients"."quantity_text" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"source_book" varchar,
	"source_page" integer,
	"base_servings" integer NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menus_user_id_date_idx" ON "menus" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_user_id_idx" ON "recipes" USING btree ("user_id");