<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Meme principe que la migration Kkiapay precedente (meme avertissement
     * sur le ENUM natif MySQL). 'kkiapay' reste dans la liste : d'anciens
     * paiements valides sous ce mode existent peut-etre deja en base, les
     * retirer casserait leur lecture.
     */
    public function up(): void
    {
        if (! Schema::hasTable('subscription_payments')) {
            return;
        }

        DB::statement("
            ALTER TABLE subscription_payments
            MODIFY payment_method ENUM('mobile_money_mtn','mobile_money_moov','virement','especes','kkiapay','paydunya')
            NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE subscription_payments
            MODIFY payment_method ENUM('mobile_money_mtn','mobile_money_moov','virement','especes','kkiapay')
            NOT NULL
        ");
    }
};
