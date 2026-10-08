<?php

namespace App\Http\Requests\Transactions;

use App\Domain\Transactions\Money;
use App\Domain\Transactions\TransactionStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Throwable;

class TransactionIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $moneyRule = function (string $attribute, mixed $value, callable $fail): void {
            try {
                Money::fromDecimal((string) $value);
            } catch (Throwable) {
                $fail("The {$attribute} must be a positive decimal string with at most two fraction digits.");
            }
        };

        return [
            'status' => ['sometimes', Rule::enum(TransactionStatus::class)],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
            'min_amount' => ['sometimes', 'string', $moneyRule],
            'max_amount' => ['sometimes', 'string', $moneyRule],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->hasAny(['min_amount', 'max_amount'])
                    || ! $this->filled(['min_amount', 'max_amount'])) {
                    return;
                }

                if ($this->minAmountCents() > $this->maxAmountCents()) {
                    $validator->errors()->add('max_amount', 'The max amount must be greater than or equal to the min amount.');
                }
            },
        ];
    }

    public function minAmountCents(): ?int
    {
        return $this->filled('min_amount')
            ? Money::fromDecimal((string) $this->input('min_amount'))->cents
            : null;
    }

    public function maxAmountCents(): ?int
    {
        return $this->filled('max_amount')
            ? Money::fromDecimal((string) $this->input('max_amount'))->cents
            : null;
    }
}
