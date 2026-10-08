<?php

namespace App\Console\Commands;

use App\Application\Transactions\Actions\StartTransactionIngestion;
use Illuminate\Console\Command;

class IngestTransactions extends Command
{
    protected $signature = 'transactions:ingest
                            {path=transactions.json : Fixture path relative to database/fixtures}';

    protected $description = 'Queue ingestion of transactions from a local JSON fixture';

    public function handle(StartTransactionIngestion $startIngestion): int
    {
        $run = $startIngestion->handle((string) $this->argument('path'));

        $this->components->info("Ingestion run {$run->getKey()} queued.");

        return self::SUCCESS;
    }
}
