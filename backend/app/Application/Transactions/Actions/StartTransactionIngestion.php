<?php

namespace App\Application\Transactions\Actions;

use App\Domain\Transactions\IngestionRunStatus;
use App\Jobs\FetchExternalTransactionsJob;
use App\Models\IngestionRun;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class StartTransactionIngestion
{
    public function handle(string $path): IngestionRun
    {
        $path = trim($path);

        if ($path === '' || str_contains($path, "\0")) {
            throw new InvalidArgumentException('A valid fixture path is required.');
        }

        return DB::transaction(function () use ($path): IngestionRun {
            $run = IngestionRun::create([
                'source' => 'local-json',
                'source_path' => $path,
                'status' => IngestionRunStatus::Pending,
            ]);

            FetchExternalTransactionsJob::dispatch($run->getKey(), $path)->beforeCommit();

            return $run;
        });
    }
}
