<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditReminder extends Model
{
    protected $table = 'credit_reminders';

    protected $fillable = [
        'credit_sale_id',
        'channel',
        'phone',
        'message',
        'status',
        'provider_ref',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    public function creditSale()
    {
        return $this->belongsTo(CreditSale::class);
    }
}
