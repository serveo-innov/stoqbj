<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stationery_shops', function (Blueprint $table) {
            $table->id();
            $table->string('shop_name', 150);
            $table->string('legal_form', 80)->nullable();
            $table->string('owner_name', 100);
            $table->string('owner_firstname', 100);
            $table->string('owner_phone', 20);
            $table->string('owner_phone_secondary', 20)->nullable();
            $table->string('owner_email', 150)->unique();
            $table->string('owner_id_scan_path', 255)->nullable();
            $table->text('address');
            $table->string('neighborhood', 100)->nullable();
            $table->string('city', 80);
            $table->string('country', 80)->default('Bénin');
            $table->decimal('gps_lat', 10, 7)->nullable();
            $table->decimal('gps_lng', 10, 7)->nullable();
            $table->string('ifu_number', 30)->nullable();
            $table->string('rccm_number', 30)->nullable();
            $table->string('commercial_name', 150)->nullable();
            $table->string('logo_path', 255)->nullable();
            $table->string('slogan', 255)->nullable();
            $table->string('brand_color', 7)->default('#1a73e8');
            $table->date('subscription_start')->nullable();
            $table->date('subscription_end')->nullable();
            $table->enum('status', ['trial', 'active', 'suspended', 'closed'])->default('trial');
            $table->integer('trial_days')->default(14);
            $table->integer('default_credit_days')->default(7); // délai crédit configurable
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stationery_shops');
    }
};
