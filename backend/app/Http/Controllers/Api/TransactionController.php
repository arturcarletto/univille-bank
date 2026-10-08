<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transactions\TransactionIndexRequest;
use App\Http\Resources\TransactionResource;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TransactionController extends Controller
{
    public function index(TransactionIndexRequest $request): AnonymousResourceCollection
    {
        $query = Transaction::query()
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')->toString()),
            )
            ->when(
                $request->filled('from'),
                fn ($query) => $query->where(
                    'received_at',
                    '>=',
                    CarbonImmutable::createFromFormat('Y-m-d', $request->string('from')->toString())->startOfDay(),
                ),
            )
            ->when(
                $request->filled('to'),
                fn ($query) => $query->where(
                    'received_at',
                    '<=',
                    CarbonImmutable::createFromFormat('Y-m-d', $request->string('to')->toString())->endOfDay(),
                ),
            )
            ->when(
                $request->minAmountCents() !== null,
                fn ($query) => $query->where('amount_cents', '>=', $request->minAmountCents()),
            )
            ->when(
                $request->maxAmountCents() !== null,
                fn ($query) => $query->where('amount_cents', '<=', $request->maxAmountCents()),
            )
            ->orderByDesc('received_at')
            ->orderByDesc('id');

        return TransactionResource::collection(
            $query->paginate($request->integer('per_page', 15))->withQueryString(),
        );
    }
}
