<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * IMPORTANT : cette migration suppose que `payment_method` est un ENUM MySQL natif
     * sur la table subscription_payments (cohérent avec la règle de validation
     * 'in:mobile_money_mtn,mobile_money_moov,virement,especes' vue dans ShopController).
     *
     * Avant d'exécuter, vérifie la définition actuelle de la colonne avec :
     *   SHOW COLUMNS FROM subscription_payments LIKE 'payment_method';
     *
     * Si ce n'est PAS un ENUM (ex: simple VARCHAR), cette migration ne fait rien de
     * cassant mais n'est pas non plus nécessaire — tu peux la supprimer.
     */
    public function up(): void
    {
        if (! Schema::hasTable('subscription_payments')) {
            return;
        }

        DB::statement("
            ALTER TABLE subscription_payments
            MODIFY payment_method ENUM('mobile_money_mtn','mobile_money_moov','virement','especes','kkiapay')
            NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE subscription_payments
            MODIFY payment_method ENUM('mobile_money_mtn','mobile_money_moov','virement','especes')
            NOT NULL
        ");
    }
};
