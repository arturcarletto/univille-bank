<?php

namespace Tests\Feature;

use App\Application\Transactions\Actions\ProcessTransaction;
use App\Application\Transactions\Contracts\TransactionSource;
use App\Application\Transactions\Exceptions\CorruptSourceException;
use App\Application\Transactions\Exceptions\SourceUnavailableException;
use App\Domain\Transactions\IngestionRunStatus;
use App\Domain\Transactions\TransactionStatus;
use App\Jobs\FetchExternalTransactionsJob;
use App\Jobs\ProcessTransactionJob;
use App\Models\IngestionRun;
use App\Models\Transaction;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

class TransactionIngestionTest extends TestCase
{
    use DatabaseMigrations;

    public function test_command_creates_an_ingestion_run_and_queues_source_fetch(): void
    {
        Queue::fake();

        $this->artisan('transactions:ingest')->assertSuccessful();

        $this->assertDatabaseHas('ingestion_runs', [
            'source' => 'local-json',
            'source_path' => 'transactions.json',
            'status' => IngestionRunStatus::Pending->value,
        ]);
        Queue::assertPushed(FetchExternalTransactionsJob::class, 1);
    }

    public function test_valid_source_persists_each_item_and_dispatches_one_processing_job_per_item(): void
    {
        Queue::fake([ProcessTransactionJob::class]);
        $run = IngestionRun::factory()->create();

        (new FetchExternalTransactionsJob($run->getKey(), 'transactions.json'))
            ->handle(app(TransactionSource::class));

        $this->assertDatabaseCount('transactions', 3);
        $this->assertDatabaseHas('ingestion_runs', [
            'id' => $run->getKey(),
            'status' => IngestionRunStatus::Dispatched->value,
        ]);
        Queue::assertPushed(ProcessTransactionJob::class, 3);
    }

    public function test_sync_queue_processes_valid_and_invalid_items_end_to_end(): void
    {
        $this->artisan('transactions:ingest', [
            'path' => 'transactions-with-invalid.json',
        ])->assertSuccessful();

        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseHas('transactions', [
            'external_id' => 'TX-2001',
            'status' => TransactionStatus::Processed->value,
            'amount_cents' => 1025,
        ]);
        $this->assertDatabaseHas('transactions', [
            'external_id' => null,
            'status' => TransactionStatus::Invalid->value,
        ]);
    }

    public function test_processing_job_persists_valid_money_without_float(): void
    {
        $transaction = Transaction::factory()->pending()->create([
            'external_id' => 'TX-EXACT',
            'raw_payload' => json_encode([
                'external_id' => 'TX-EXACT',
                'amount' => '123456789.01',
                'currency' => 'brl',
                'occurred_at' => '2026-10-08T10:00:00-03:00',
            ], JSON_THROW_ON_ERROR),
        ]);

        (new ProcessTransactionJob($transaction->getKey()))
            ->handle(app(ProcessTransaction::class));

        $transaction->refresh();

        $this->assertSame(TransactionStatus::Processed, $transaction->status);
        $this->assertSame(12345678901, $transaction->amount_cents);
        $this->assertSame('BRL', $transaction->currency);
        $this->assertNotNull($transaction->processed_at);
    }

    public function test_invalid_item_is_recorded_without_retrying_as_an_exception(): void
    {
        $transaction = Transaction::factory()->pending()->create([
            'external_id' => null,
            'raw_payload' => json_encode([
                'amount' => 'not-a-number',
                'currency' => 'BRL',
                'occurred_at' => '2026-10-08T10:00:00-03:00',
            ], JSON_THROW_ON_ERROR),
        ]);

        (new ProcessTransactionJob($transaction->getKey()))
            ->handle(app(ProcessTransaction::class));

        $transaction->refresh();

        $this->assertSame(TransactionStatus::Invalid, $transaction->status);
        $this->assertNotNull($transaction->failure_reason);
    }

    public function test_reingestion_does_not_duplicate_transactions_or_jobs(): void
    {
        Queue::fake([ProcessTransactionJob::class]);
        $source = app(TransactionSource::class);
        $firstRun = IngestionRun::factory()->create();
        $secondRun = IngestionRun::factory()->create();

        (new FetchExternalTransactionsJob($firstRun->getKey(), 'transactions.json'))->handle($source);
        (new FetchExternalTransactionsJob($secondRun->getKey(), 'transactions.json'))->handle($source);

        $this->assertDatabaseCount('transactions', 3);
        Queue::assertPushed(ProcessTransactionJob::class, 3);
    }

    public function test_missing_and_corrupt_sources_are_reported_for_job_retry(): void
    {
        $source = app(TransactionSource::class);

        try {
            $source->read('missing.json');
            $this->fail('Missing fixture should have thrown an exception.');
        } catch (SourceUnavailableException) {
            $this->addToAssertionCount(1);
        }

        $this->expectException(CorruptSourceException::class);
        $source->read('corrupt.json');
    }

    public function test_source_cannot_escape_the_fixture_directory(): void
    {
        $this->expectException(SourceUnavailableException::class);

        app(TransactionSource::class)->read('../composer.json');
    }

    public function test_jobs_define_retry_backoff_and_record_terminal_failures(): void
    {
        $run = IngestionRun::factory()->create();
        $fetchJob = new FetchExternalTransactionsJob($run->getKey(), 'missing.json');

        $this->assertSame(3, $fetchJob->tries);
        $this->assertSame([5, 30, 120], $fetchJob->backoff());

        $fetchJob->failed(new RuntimeException('source unavailable'));

        $this->assertDatabaseHas('ingestion_runs', [
            'id' => $run->getKey(),
            'status' => IngestionRunStatus::Failed->value,
        ]);

        $transaction = Transaction::factory()->pending()->create();
        $processingJob = new ProcessTransactionJob($transaction->getKey());
        $processingJob->failed(new RuntimeException('unexpected processing failure'));

        $this->assertDatabaseHas('transactions', [
            'id' => $transaction->getKey(),
            'status' => TransactionStatus::Failed->value,
        ]);
    }

    public function test_database_queue_connection_persists_jobs(): void
    {
        $transaction = Transaction::factory()->pending()->create();

        Queue::connection('database')->push(new ProcessTransactionJob($transaction->getKey()));

        $this->assertDatabaseCount('jobs', 1);
    }

    public function test_ingestion_run_owns_transactions_with_a_real_foreign_key(): void
    {
        $run = IngestionRun::factory()->create();
        Transaction::factory()->create(['ingestion_run_id' => $run->getKey()]);

        $run->delete();

        $this->assertDatabaseCount('transactions', 0);
    }
}
