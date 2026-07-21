<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyReport extends Model
{
    protected $fillable = [
        'shop_id',
        'report_date',
        'ca_gros',
        'ca_detail',
        'ca_extra',
        'ca_total',
        'encaissements',
        'credits_accordes',
        'credits_percus',
        'nb_transactions',
        'nb_new_credits',
        'top_products',
        'stock_alerts',
        'pdf_path',
        'signature',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'report_date'      => 'date',
            'generated_at'     => 'datetime',
            'ca_gros'          => 'decimal:2',
            'ca_detail'        => 'decimal:2',
            'ca_extra'         => 'decimal:2',
            'ca_total'         => 'decimal:2',
            'encaissements'    => 'decimal:2',
            'credits_accordes' => 'decimal:2',
            'credits_percus'   => 'decimal:2',
            'top_products'     => 'array',
            'stock_alerts'     => 'array',
        ];
    }

    public function shop()
    {
        return $this->belongsTo(StationeryShop::class, 'shop_id');
    }
}
