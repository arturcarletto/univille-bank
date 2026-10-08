<?php

namespace Tests\Feature;

use App\Domain\Transactions\TransactionStatus;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
    }

    public function test_transactions_are_paginated_and_money_is_serialized_exactly(): void
    {
        Transaction::factory()->count(3)->create(['amount_cents' => 12550]);
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/transactions?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.amount', '125.50')
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3);
    }

    public function test_status_period_and_value_filters_run_together(): void
    {
        Transaction::factory()->create([
            'status' => TransactionStatus::Processed,
            'amount_cents' => 15000,
            'received_at' => '2026-10-08 12:00:00',
        ]);
        Transaction::factory()->create([
            'status' => TransactionStatus::Processed,
            'amount_cents' => 5000,
            'received_at' => '2026-10-08 13:00:00',
        ]);
        Transaction::factory()->pending()->create([
            'received_at' => '2026-10-08 14:00:00',
        ]);
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/transactions?status=processed&from=2026-10-08&to=2026-10-08&min_amount=100.00&max_amount=200.00')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.amount', '150.00');
    }

    public function test_filter_validation_rejects_invalid_ranges(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/transactions?status=unknown&min_amount=20.00&max_amount=10.00&per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status', 'max_amount', 'per_page']);
    }

    public function test_dashboard_summary_counts_pending_and_processed_transactions(): void
    {
        Transaction::factory()->count(2)->pending()->create();
        Transaction::factory()->count(3)->create(['status' => TransactionStatus::Processed]);
        Transaction::factory()->create(['status' => TransactionStatus::Invalid]);
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/dashboard/summary')
            ->assertOk()
            ->assertExactJson([
                'pending' => 2,
                'processed' => 3,
            ]);
    }
}
