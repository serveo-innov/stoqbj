<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('stationery_shops')->cascadeOnDelete();
            $table->date('report_date')->unique();
            $table->decimal('ca_gros', 12, 2)->default(0);
            $table->decimal('ca_detail', 12, 2)->default(0);
            $table->decimal('ca_extra', 12, 2)->default(0);
            $table->decimal('ca_total', 12, 2)->default(0);
            $table->decimal('encaissements', 12, 2)->default(0);
            $table->decimal('credits_accordes', 12, 2)->default(0);
            $table->decimal('credits_percus', 12, 2)->default(0);
            $table->integer('nb_transactions')->default(0);
            $table->integer('nb_new_credits')->default(0);
            $table->json('top_products')->nullable(); // top 5
            $table->json('stock_alerts')->nullable();
            $table->string('pdf_path', 255)->nullable();
            $table->string('signature', 64)->nullable(); // signature numérique
            $table->timestamp('generated_at')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'report_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};
