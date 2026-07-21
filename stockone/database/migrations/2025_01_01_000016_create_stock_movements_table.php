<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->constrained('product_units');
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('sale_id')->nullable()->constrained('sales')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete();
            $table->enum('type', ['entry', 'sale', 'adjustment', 'return', 'loss', 'internal_use', 'inventory']);
            $table->integer('quantity'); // positif = entrée, négatif = sortie
            $table->integer('stock_before');
            $table->integer('stock_after');
            $table->decimal('unit_cost', 10, 2)->nullable(); // coût unitaire à l'entrée
            $table->string('reference', 100)->nullable(); // bon fournisseur, etc.
            $table->text('reason')->nullable();
            $table->timestamp('moved_at');
            $table->timestamps();

            $table->index('shop_id');
            $table->index('product_unit_id');
            $table->index(['shop_id', 'moved_at']);
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
