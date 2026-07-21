<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 10, 2)->default(35000.00);
            $table->enum('payment_method', ['mobile_money_mtn', 'mobile_money_moov', 'virement', 'especes']);
            $table->string('transaction_ref', 100)->nullable();
            $table->string('proof_path', 255)->nullable(); // scan reçu
            $table->date('payment_date');
            $table->date('period_start');
            $table->date('period_end');
            $table->enum('status', ['pending', 'validated', 'rejected'])->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('shop_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
    }
};
