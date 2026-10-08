<?php

namespace Database\Factories;

use App\Domain\Transactions\IngestionRunStatus;
use App\Models\IngestionRun;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<IngestionRun> */
class IngestionRunFactory extends Factory
{
    protected $model = IngestionRun::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'source' => 'local-json',
            'source_path' => 'transactions.json',
            'status' => IngestionRunStatus::Pending,
            'failure_reason' => null,
        ];
    }
}
