<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * IMPORTANT : cette table fait partie des migrations par défaut de Laravel
     * (souvent déjà créée via 0001_01_01_000000_create_users_table.php).
     * Avant d'exécuter `php artisan migrate`, vérifie qu'elle n'existe pas déjà
     * avec : php artisan migrate:status
     * Si elle existe déjà, NE PAS exécuter ce fichier (supprime-le ou renomme-le).
     */
    public function up(): void
    {
        if (Schema::hasTable('password_reset_tokens')) {
            return;
        }

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
    }
};
