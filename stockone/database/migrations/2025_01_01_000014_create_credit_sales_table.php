<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignId('client_id')->constrained('clients');
            $table->decimal('amount_due', 12, 2);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('amount_remaining', 12, 2);
            $table->date('due_date');
            $table->integer('credit_days'); // délai accordé
            $table->enum('status', ['pending', 'partial', 'paid', 'overdue', 'doubtful'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('shop_id');
            $table->index('client_id');
            $table->index('due_date');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_sales');
    }
};
