<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users'); // caissier
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->string('invoice_number', 30)->nullable(); // FAC-YYYY-XXXXX
            $table->decimal('total_amount', 12, 2);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2);
            $table->enum('payment_mode', ['cash', 'credit', 'mobile_money', 'mixed'])->default('cash');
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('amount_due', 12, 2)->default(0);
            $table->enum('status', ['completed', 'pending', 'cancelled', 'on_hold'])->default('completed');
            $table->boolean('invoice_printed')->default(false);
            $table->text('notes')->nullable();
            $table->timestamp('sold_at'); // heure réelle de la vente
            $table->timestamps();

            $table->index('shop_id');
            $table->index(['shop_id', 'sold_at']);
            $table->index('user_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
