<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('credit_sale_id')->constrained('credit_sales')->cascadeOnDelete();
            $table->enum('channel', ['sms', 'platform', 'email'])->default('platform');
            $table->string('phone', 20)->nullable();
            $table->text('message');
            $table->enum('status', ['sent', 'failed', 'pending'])->default('pending');
            $table->string('provider_ref', 100)->nullable(); // référence Africa's Talking
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index('credit_sale_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_reminders');
    }
};
