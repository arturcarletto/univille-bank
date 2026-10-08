<?php

namespace App\Models;

use App\Domain\Transactions\IngestionRunStatus;
use Database\Factories\IngestionRunFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IngestionRun extends Model
{
    /** @use HasFactory<IngestionRunFactory> */
    use HasFactory;

    protected $fillable = [
        'source',
        'source_path',
        'status',
        'failure_reason',
    ];

    /** @return HasMany<Transaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => IngestionRunStatus::class,
        ];
    }
}
