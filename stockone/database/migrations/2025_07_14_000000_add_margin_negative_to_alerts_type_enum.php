<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

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
            'margin_negative'
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
            'credit_overdue'
        )");
    }
};
