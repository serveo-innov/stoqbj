<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('extra_sale_identities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('firstname', 100);
            $table->string('phone', 20);
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index('sale_id');
            $table->index('phone');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extra_sale_identities');
    }
};
