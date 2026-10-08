<?php

namespace Database\Factories;

use App\Domain\Transactions\TransactionStatus;
use App\Models\IngestionRun;
use App\Models\Transaction;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Transaction> */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $externalId = (string) Str::uuid();

        return [
            'ingestion_run_id' => IngestionRun::factory(),
            'external_id' => $externalId,
            'ingestion_key' => hash('sha256', 'local-json:external:'.$externalId),
            'status' => TransactionStatus::Processed,
            'amount_cents' => fake()->numberBetween(1, 1000000),
            'currency' => 'BRL',
            'occurred_at' => now()->subDay(),
            'raw_payload' => '{}',
            'failure_reason' => null,
            'received_at' => now(),
            'processed_at' => now(),
        ];
    }

    public function pending(): static
    {
        return $this->state(fn () => [
            'status' => TransactionStatus::Pending,
            'amount_cents' => null,
            'currency' => null,
            'occurred_at' => null,
            'processed_at' => null,
        ]);
    }
}
