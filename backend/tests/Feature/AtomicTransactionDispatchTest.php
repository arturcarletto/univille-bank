<?php

namespace Tests\Feature;

use App\Application\Transactions\Actions\StartTransactionIngestion;
use App\Application\Transactions\Contracts\TransactionSource;
use App\Domain\Transactions\IngestionRunStatus;
use App\Domain\Transactions\TransactionStatus;
use App\Jobs\FetchExternalTransactionsJob;
use App\Jobs\ProcessTransactionJob;
use App\Models\IngestionRun;
use App\Models\Transaction;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Queue\DatabaseQueue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class AtomicTransactionDispatchTest extends TestCase
{
    use DatabaseMigrations;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'queue.default' => 'database',
            'queue.connections.database.connection' => 'sqlite',
            'queue.connections.database.after_commit' => true,
            'queue.failed.database' => 'sqlite',
            'logging.default' => 'null',
        ]);

        $queue = Queue::connection('database');

        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->assertInstanceOf(DatabaseQueue::class, $queue);
        $this->assertSame(DB::connection(), $queue->getDatabase());
    }

    public function test_ingestion_and_individual_jobs_use_the_database_queue_without_sync_processing(): void
    {
        $this->artisan('transactions:ingest')->assertSuccessful();

        $this->assertDatabaseCount('ingestion_runs', 1);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseHas('ingestion_runs', [
            'status' => IngestionRunStatus::Pending->value,
        ]);

        $payload = json_decode(DB::table('jobs')->value('payload'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(FetchExternalTransactionsJob::class, $payload['displayName']);

        $this->workOnce();

        $this->assertDatabaseCount('transactions', 3);
        $this->assertSame(3, Transaction::query()->where('status', TransactionStatus::Pending)->count());
        $this->assertDatabaseCount('jobs', 3);
        $this->assertDatabaseHas('ingestion_runs', [
            'status' => IngestionRunStatus::Dispatched->value,
        ]);
        $this->assertSame(
            Transaction::query()->orderBy('id')->pluck('id')->all(),
            $this->processingJobTransactionIds(),
        );

        $this->workOnce();

        $this->assertSame(1, Transaction::query()->where('status', TransactionStatus::Processed)->count());
        $this->assertSame(2, Transaction::query()->where('status', TransactionStatus::Pending)->count());
        $this->assertDatabaseCount('jobs', 2);
        $this->assertDatabaseHas('transactions', [
            'external_id' => 'TX-1001',
            'status' => TransactionStatus::Processed->value,
            'amount_cents' => 125050,
        ]);
    }

    public function test_initial_enqueue_failure_rolls_back_the_run_and_allows_a_clean_retry(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE TEMP TRIGGER reject_fetch_enqueue
            BEFORE INSERT ON jobs
            BEGIN
                SELECT RAISE(ABORT, 'Controlled Fetch enqueue failure');
            END
            SQL);

        try {
            app(StartTransactionIngestion::class)->handle('transactions.json');
            $this->fail('The database queue insert should have failed.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('Controlled Fetch enqueue failure', $exception->getMessage());
        }

        $this->assertDatabaseCount('ingestion_runs', 0);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('jobs', 0);

        DB::unprepared('DROP TRIGGER reject_fetch_enqueue');

        $run = app(StartTransactionIngestion::class)->handle('transactions.json');

        $this->assertDatabaseCount('ingestion_runs', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertSame(IngestionRunStatus::Pending, $run->status);
    }

    public function test_partial_enqueue_failure_rolls_back_only_the_item_and_reingestion_does_not_duplicate_jobs(): void
    {
        $run = IngestionRun::factory()->create();
        $source = app(TransactionSource::class);
        $fetch = new FetchExternalTransactionsJob($run->getKey(), 'transactions.json');

        DB::unprepared(<<<'SQL'
            CREATE TEMP TRIGGER reject_second_item_enqueue
            BEFORE INSERT ON jobs
            WHEN EXISTS (SELECT 1 FROM transactions WHERE external_id = 'TX-1002')
            BEGIN
                SELECT RAISE(ABORT, 'Controlled Process enqueue failure');
            END
            SQL);

        try {
            $fetch->handle($source);
            $this->fail('The second item queue insert should have failed.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('Controlled Process enqueue failure', $exception->getMessage());
        }

        $firstId = Transaction::query()->where('external_id', 'TX-1001')->sole()->getKey();

        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseMissing('transactions', ['external_id' => 'TX-1002']);
        $this->assertDatabaseMissing('transactions', ['external_id' => 'TX-1003']);
        $this->assertSame([$firstId], $this->processingJobTransactionIds());
        $this->assertSame(IngestionRunStatus::Pending, $run->fresh()->status);

        DB::unprepared('DROP TRIGGER reject_second_item_enqueue');
        $fetch->handle($source);

        $this->assertDatabaseCount('transactions', 3);
        $this->assertDatabaseCount('jobs', 3);
        $this->assertSame($firstId, Transaction::query()->where('external_id', 'TX-1001')->sole()->getKey());
        $this->assertSame(IngestionRunStatus::Dispatched, $run->fresh()->status);
        $this->assertSame(
            Transaction::query()->orderBy('id')->pluck('id')->all(),
            $this->processingJobTransactionIds(),
        );

        $secondRun = IngestionRun::factory()->create();
        (new FetchExternalTransactionsJob($secondRun->getKey(), 'transactions.json'))->handle($source);

        $this->assertDatabaseCount('transactions', 3);
        $this->assertDatabaseCount('jobs', 3);
        $this->assertSame(IngestionRunStatus::Dispatched, $secondRun->fresh()->status);
        $this->assertSame(
            Transaction::query()->orderBy('id')->pluck('id')->all(),
            $this->processingJobTransactionIds(),
        );
    }

    public function test_worker_retries_a_transient_processing_failure_without_blocking_another_item(): void
    {
        $this->freezeTime();
        $this->enqueueValidAndInvalidItems();

        DB::unprepared(<<<'SQL'
            CREATE TEMP TRIGGER reject_processing
            BEFORE UPDATE OF status ON transactions
            WHEN NEW.status = 'processed'
            BEGIN
                SELECT RAISE(ABORT, 'Controlled transient processing failure');
            END
            SQL);

        $uuid = json_decode(DB::table('jobs')->orderBy('id')->value('payload'), true, 512, JSON_THROW_ON_ERROR)['uuid'];

        $this->workOnce();

        $this->assertDatabaseHas('transactions', [
            'external_id' => 'TX-2001',
            'status' => TransactionStatus::Pending->value,
        ]);
        $this->assertDatabaseCount('jobs', 2);
        $this->assertDatabaseCount('failed_jobs', 0);

        $retry = DB::table('jobs')->where('attempts', 1)->sole();
        $retryPayload = json_decode($retry->payload, true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame($uuid, $retryPayload['uuid']);
        $this->assertNull($retry->reserved_at);
        $this->assertSame(now()->getTimestamp() + 5, (int) $retry->available_at);

        $this->workOnce();

        $this->assertSame(1, Transaction::query()->where('status', TransactionStatus::Invalid)->count());
        $this->assertDatabaseCount('jobs', 1);

        DB::unprepared('DROP TRIGGER reject_processing');
        $this->travel(6)->seconds();
        $this->workOnce();

        $this->assertDatabaseHas('transactions', [
            'external_id' => 'TX-2001',
            'status' => TransactionStatus::Processed->value,
            'amount_cents' => 1025,
        ]);
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('failed_jobs', 0);
    }

    public function test_worker_records_a_definitive_processing_failure_after_three_attempts(): void
    {
        $this->freezeTime();
        $this->enqueueValidAndInvalidItems();

        DB::unprepared(<<<'SQL'
            CREATE TEMP TRIGGER reject_processing
            BEFORE UPDATE OF status ON transactions
            WHEN NEW.status = 'processed'
            BEGIN
                SELECT RAISE(ABORT, 'Controlled definitive processing failure');
            END
            SQL);

        $uuid = json_decode(DB::table('jobs')->orderBy('id')->value('payload'), true, 512, JSON_THROW_ON_ERROR)['uuid'];

        $this->workOnce();
        $this->workOnce();

        $this->assertDatabaseCount('failed_jobs', 0);
        $this->assertDatabaseHas('jobs', ['attempts' => 1]);

        $this->travel(6)->seconds();
        $this->workOnce();

        $this->assertDatabaseCount('failed_jobs', 0);
        $retry = DB::table('jobs')->sole();
        $this->assertSame(2, (int) $retry->attempts);
        $this->assertSame(now()->getTimestamp() + 30, (int) $retry->available_at);

        $this->travel(31)->seconds();
        $this->workOnce();

        $transaction = Transaction::query()->where('external_id', 'TX-2001')->sole();

        $this->assertSame(TransactionStatus::Failed, $transaction->status);
        $this->assertNotNull($transaction->processed_at);
        $this->assertStringContainsString('Controlled definitive processing failure', $transaction->failure_reason);
        $this->assertSame(1, Transaction::query()->where('status', TransactionStatus::Invalid)->count());
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('failed_jobs', 1);
        $this->assertDatabaseHas('failed_jobs', [
            'uuid' => $uuid,
            'connection' => 'database',
        ]);
    }

    /** @return list<int> */
    private function processingJobTransactionIds(): array
    {
        $ids = [];

        foreach (DB::table('jobs')->orderBy('id')->pluck('payload') as $rawPayload) {
            $payload = json_decode($rawPayload, true, 512, JSON_THROW_ON_ERROR);
            $this->assertSame(ProcessTransactionJob::class, $payload['displayName']);

            $job = unserialize($payload['data']['command'], [
                'allowed_classes' => [ProcessTransactionJob::class],
            ]);

            $this->assertInstanceOf(ProcessTransactionJob::class, $job);
            $ids[] = $job->transactionId;
        }

        sort($ids);

        return $ids;
    }

    private function enqueueValidAndInvalidItems(): void
    {
        $run = IngestionRun::factory()->create();

        (new FetchExternalTransactionsJob($run->getKey(), 'transactions-with-invalid.json'))
            ->handle(app(TransactionSource::class));

        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseCount('jobs', 2);
    }

    private function workOnce(): void
    {
        $this->artisan('queue:work', [
            'connection' => 'database',
            '--once' => true,
            '--sleep' => 0,
            '--tries' => 3,
            '--no-interaction' => true,
        ])->assertSuccessful();
    }
}
