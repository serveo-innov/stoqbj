<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_unit_id')->constrained('product_units')->cascadeOnDelete();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('old_price_wholesale', 10, 2);
            $table->decimal('new_price_wholesale', 10, 2);
            $table->decimal('old_price_extra', 10, 2);
            $table->decimal('new_price_extra', 10, 2);
            $table->decimal('old_cost_price', 10, 2);
            $table->decimal('new_cost_price', 10, 2);
            $table->enum('reason', ['manual', 'ai_suggestion', 'promotion', 'correction']);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('product_unit_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('price_history');
    }
};
