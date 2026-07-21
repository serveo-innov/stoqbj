<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('kkiapay_payment_intents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('reference', 64)->unique(); // envoyee au widget Kkiapay via le champ "data"
            $table->enum('status', ['pending', 'consumed', 'expired'])->default('pending');
            $table->string('consumed_transaction_ref')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('kkiapay_payment_intents');
    }
};
