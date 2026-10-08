<?php

namespace App\Jobs;

use App\Application\Transactions\Contracts\TransactionSource;
use App\Domain\Transactions\IngestionRunStatus;
use App\Domain\Transactions\TransactionStatus;
use App\Models\IngestionRun;
use App\Models\Transaction;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;
use Throwable;

class FetchExternalTransactionsJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $maxExceptions = 3;

    public int $timeout = 60;

    public function __construct(
        public int $ingestionRunId,
        public string $path,
    ) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 30, 120];
    }

    public function handle(TransactionSource $source): void
    {
        $run = IngestionRun::query()->findOrFail($this->ingestionRunId);
        $payloads = $source->read($this->path);

        foreach ($payloads as $payload) {
            DB::transaction(function () use ($run, $payload): void {
                $rawPayload = $this->encodePayload($payload);
                $externalId = $this->externalId($payload);
                $transaction = Transaction::firstOrCreate(
                    ['ingestion_key' => $this->ingestionKey($externalId, $rawPayload)],
                    [
                        'ingestion_run_id' => $run->getKey(),
                        'external_id' => $externalId,
                        'status' => TransactionStatus::Pending,
                        'raw_payload' => $rawPayload,
                        'received_at' => now(),
                    ],
                );

                if ($transaction->wasRecentlyCreated) {
                    ProcessTransactionJob::dispatch($transaction->getKey())->afterCommit();
                }
            });
        }

        $run->update([
            'status' => IngestionRunStatus::Dispatched,
            'failure_reason' => null,
        ]);
    }

    public function failed(?Throwable $exception): void
    {
        IngestionRun::query()->whereKey($this->ingestionRunId)->update([
            'status' => IngestionRunStatus::Failed->value,
            'failure_reason' => Str::limit(
                $exception?->getMessage() ?? 'The source ingestion failed after all retry attempts.',
                1000,
            ),
        ]);
    }

    private function externalId(mixed $payload): ?string
    {
        if (! is_array($payload) || ! isset($payload['external_id']) || ! is_string($payload['external_id'])) {
            return null;
        }

        $externalId = trim($payload['external_id']);

        return $externalId === '' ? null : $externalId;
    }

    private function ingestionKey(?string $externalId, string $rawPayload): string
    {
        $identity = $externalId === null
            ? 'invalid:'.hash('sha256', $rawPayload)
            : 'external:'.$externalId;

        return hash('sha256', 'local-json:'.$identity);
    }

    private function encodePayload(mixed $payload): string
    {
        try {
            return json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } catch (JsonException $exception) {
            throw new JsonException('A transaction payload could not be normalized.', previous: $exception);
        }
    }
}
