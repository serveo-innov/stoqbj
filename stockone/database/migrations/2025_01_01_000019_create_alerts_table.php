<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Alertes générales (stock, abonnement, dormants)
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->nullOnDelete();
            $table->enum('type', [
                'stock_out',
                'stock_low',
                'stock_critical',
                'dormant_30',
                'dormant_45',
                'dormant_60',
                'dormant_90',
                'dormant_120',
                'subscription_expiry',
                'credit_overdue',
            ]);
            $table->boolean('is_read')->default(false);
            $table->boolean('is_resolved')->default(false);
            $table->json('meta')->nullable(); // données contextuelles
            $table->timestamp('triggered_at');
            $table->timestamps();

            $table->index(['shop_id', 'is_read']);
            $table->index(['shop_id', 'type']);
        });

        // Suggestions de réajustement de prix IA
        Schema::create('price_suggestions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->constrained('product_units')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('current_price_wholesale', 10, 2);
            $table->decimal('suggested_price_wholesale', 10, 2);
            $table->decimal('current_price_extra', 10, 2);
            $table->decimal('suggested_price_extra', 10, 2);
            $table->integer('dormant_days');
            $table->decimal('estimated_margin', 5, 2)->nullable(); // % marge résultante
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            // Suivi impact (ventes dans les 15j suivant l'ajustement)
            $table->integer('sales_after_15days')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_suggestions');
        Schema::dropIfExists('alerts');
    }
};
