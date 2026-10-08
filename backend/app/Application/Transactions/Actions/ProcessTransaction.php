<?php

namespace App\Application\Transactions\Actions;

use App\Domain\Transactions\Money;
use App\Domain\Transactions\TransactionStatus;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use JsonException;
use Throwable;

final class ProcessTransaction
{
    public function handle(int $transactionId): void
    {
        DB::transaction(function () use ($transactionId): void {
            $transaction = Transaction::query()->lockForUpdate()->findOrFail($transactionId);

            if ($transaction->status !== TransactionStatus::Pending) {
                return;
            }

            try {
                $payload = json_decode($transaction->raw_payload, true, 512, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                $this->markInvalid($transaction, 'The transaction payload is not valid JSON.');

                return;
            }

            if (! is_array($payload)) {
                $this->markInvalid($transaction, 'The transaction payload must be a JSON object.');

                return;
            }

            $payload = $this->normalize($payload);
            $validator = Validator::make($payload, [
                'external_id' => ['required', 'string', 'max:255'],
                'amount' => [
                    'required',
                    'string',
                    function (string $attribute, mixed $value, callable $fail): void {
                        try {
                            Money::fromDecimal((string) $value);
                        } catch (Throwable) {
                            $fail('The amount must be a positive decimal string with at most two fraction digits.');
                        }
                    },
                ],
                'currency' => ['required', 'string', 'regex:/^[A-Za-z]{3}$/'],
                'occurred_at' => [
                    'required',
                    'string',
                    'regex:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/',
                ],
            ]);

            if ($validator->fails()) {
                $this->markInvalid($transaction, $validator->errors()->first());

                return;
            }

            $dateParts = date_parse($payload['occurred_at']);

            if ($dateParts['error_count'] > 0 || $dateParts['warning_count'] > 0) {
                $this->markInvalid($transaction, 'The transaction occurrence date is invalid.');

                return;
            }

            try {
                $money = Money::fromDecimal($payload['amount']);
                $occurredAt = CarbonImmutable::parse($payload['occurred_at'])->utc();
            } catch (Throwable) {
                $this->markInvalid($transaction, 'The transaction contains an invalid amount or occurrence date.');

                return;
            }

            if ($transaction->external_id !== $payload['external_id']) {
                $this->markInvalid($transaction, 'The transaction identifier does not match its ingestion key.');

                return;
            }

            $transaction->update([
                'status' => TransactionStatus::Processed,
                'amount_cents' => $money->cents,
                'currency' => strtoupper($payload['currency']),
                'occurred_at' => $occurredAt,
                'failure_reason' => null,
                'processed_at' => now(),
            ]);
        });
    }

    /**
     * @param  array<mixed>  $payload
     * @return array<mixed>
     */
    private function normalize(array $payload): array
    {
        foreach (['external_id', 'amount', 'currency', 'occurred_at'] as $field) {
            if (isset($payload[$field]) && is_string($payload[$field])) {
                $payload[$field] = trim($payload[$field]);
            }
        }

        return $payload;
    }

    private function markInvalid(Transaction $transaction, string $reason): void
    {
        $transaction->update([
            'status' => TransactionStatus::Invalid,
            'failure_reason' => Str::limit($reason, 1000),
            'processed_at' => now(),
        ]);
    }
}
