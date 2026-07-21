<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExtraSaleIdentity extends Model
{
    protected $fillable = [
        'sale_id',
        'name',
        'firstname',
        'phone',
        'remarks',
    ];

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }
}
