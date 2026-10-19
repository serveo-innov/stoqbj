<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * CORRECTIF : le webhook Kkiapay (puis PayDunya) tentait deja de creer une
 * alerte de type 'payment_unconfirmed', absente de cet ENUM depuis le
 * depart. Jamais declenche en pratique semble-t-il, mais aurait fait
 * planter le webhook (erreur SQL) des le premier vrai cas.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE alerts MODIFY COLUMN type ENUM(
            'stock_out',
            'stock_low',
            'stock_critical',
            'dormant_30',
            'dormant_45',
            'dormant_60',
            'dormant_90',
            'dormant_120',
            'subscription_expiry',
            'credit_overdue',
            'margin_negative',
            'payment_unconfirmed'
        )");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE alerts MODIFY COLUMN type ENUM(
            'stock_out',
            'stock_low',
            'stock_critical',
            'dormant_30',
            'dormant_45',
            'dormant_60',
            'dormant_90',
            'dormant_120',
            'subscription_expiry',
            'credit_overdue',
            'margin_negative'
        )");
    }
};
