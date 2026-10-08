<?php

namespace App\Models;

use App\Domain\Transactions\TransactionStatus;
use Database\Factories\TransactionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    /** @use HasFactory<TransactionFactory> */
    use HasFactory;

    protected $fillable = [
        'ingestion_run_id',
        'external_id',
        'ingestion_key',
        'status',
        'amount_cents',
        'currency',
        'occurred_at',
        'raw_payload',
        'failure_reason',
        'received_at',
        'processed_at',
    ];

    /** @return BelongsTo<IngestionRun, $this> */
    public function ingestionRun(): BelongsTo
    {
        return $this->belongsTo(IngestionRun::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => TransactionStatus::class,
            'amount_cents' => 'integer',
            'occurred_at' => 'immutable_datetime',
            'received_at' => 'immutable_datetime',
            'processed_at' => 'immutable_datetime',
        ];
    }
}
