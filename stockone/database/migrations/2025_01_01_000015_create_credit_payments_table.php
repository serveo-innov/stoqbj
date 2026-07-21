<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_sale_id')->constrained('credit_sales')->cascadeOnDelete();
            $table->foreignId('received_by')->constrained('users');
            $table->decimal('amount', 12, 2);
            $table->enum('payment_method', ['cash', 'mobile_money', 'virement'])->default('cash');
            $table->text('notes')->nullable();
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->index('credit_sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_payments');
    }
};
