<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La table et le modele s'appelaient "kkiapay_..." parce qu'ils
     * n'existaient que pour Kkiapay. Passage a PayDunya : simple
     * renommage, structure et donnees existantes intactes.
     */
    public function up(): void
    {
        if (Schema::hasTable('kkiapay_payment_intents') && ! Schema::hasTable('payment_intents')) {
            Schema::rename('kkiapay_payment_intents', 'payment_intents');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payment_intents') && ! Schema::hasTable('kkiapay_payment_intents')) {
            Schema::rename('payment_intents', 'kkiapay_payment_intents');
        }
    }
};
