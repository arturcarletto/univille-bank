<?php

namespace App\Http\Resources;

use App\Domain\Transactions\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'external_id' => $this->external_id,
            'status' => $this->status->value,
            'amount' => $this->amount_cents === null
                ? null
                : Money::fromCents($this->amount_cents)->toDecimal(),
            'currency' => $this->currency,
            'occurred_at' => $this->occurred_at?->toISOString(),
            'received_at' => $this->received_at?->toISOString(),
            'processed_at' => $this->processed_at?->toISOString(),
        ];
    }
}
