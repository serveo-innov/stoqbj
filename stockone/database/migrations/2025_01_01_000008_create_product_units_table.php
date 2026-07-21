<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('parent_unit_id')
                  ->nullable()
                  ->constrained('product_units')
                  ->nullOnDelete();
            $table->tinyInteger('level'); // 1=Gros, 2=Intermédiaire, 3=Unité
            $table->string('label', 100); // ex: 'Gros Carton', 'Petite Boîte', 'Bâton'
            $table->integer('qty_in_parent')->default(1); // quantité dans le niveau parent
            $table->decimal('price_wholesale', 10, 2)->default(0); // prix Gros
            $table->decimal('price_extra', 10, 2)->default(0);     // prix Extra (revente)
            $table->decimal('cost_price', 10, 2)->default(0);      // prix d'achat (chiffré AES-256 en prod)
            $table->boolean('is_divisible')->default(true);  // peut être détaillé au niveau inférieur
            $table->boolean('is_sellable')->default(true);   // vendable directement
            $table->integer('stock_qty')->default(0);
            $table->integer('stock_alert_threshold')->default(5);
            $table->timestamp('last_sold_at')->nullable();   // pour détection dormants
            $table->timestamps();

            $table->index('product_id');
            $table->index('parent_unit_id');
            $table->index('last_sold_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_units');
    }
};
