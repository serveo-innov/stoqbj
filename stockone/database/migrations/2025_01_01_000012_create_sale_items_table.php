<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->constrained('product_units');
            $table->enum('sale_type', ['gros', 'detail', 'extra']);
            $table->integer('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('total_price', 12, 2);
            $table->timestamps();

            $table->index('sale_id');
            $table->index('product_unit_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
