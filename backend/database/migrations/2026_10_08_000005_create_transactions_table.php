<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ingestion_run_id')->constrained()->cascadeOnDelete();
            $table->string('external_id')->nullable();
            $table->char('ingestion_key', 64)->unique();
            $table->string('status', 20);
            $table->bigInteger('amount_cents')->nullable();
            $table->char('currency', 3)->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->longText('raw_payload');
            $table->text('failure_reason')->nullable();
            $table->timestamp('received_at');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'received_at']);
            $table->index('received_at');
            $table->index('amount_cents');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
