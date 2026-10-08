<?php

namespace App\Jobs;

use App\Application\Transactions\Actions\ProcessTransaction;
use App\Domain\Transactions\TransactionStatus;
use App\Models\Transaction;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Throwable;

class ProcessTransactionJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $maxExceptions = 3;

    public int $timeout = 60;

    public function __construct(public int $transactionId) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 30, 120];
    }

    public function handle(ProcessTransaction $processTransaction): void
    {
        $processTransaction->handle($this->transactionId);
    }

    public function failed(?Throwable $exception): void
    {
        Transaction::query()
            ->whereKey($this->transactionId)
            ->where('status', TransactionStatus::Pending->value)
            ->update([
                'status' => TransactionStatus::Failed->value,
                'failure_reason' => Str::limit(
                    $exception?->getMessage() ?? 'Transaction processing failed after all retry attempts.',
                    1000,
                ),
                'processed_at' => now(),
            ]);
    }
}
